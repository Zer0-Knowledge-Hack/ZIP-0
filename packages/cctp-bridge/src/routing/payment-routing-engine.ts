import { IPaymentRouter, ISettlementRail } from "../core/interfaces.js";
import {
  BridgePaymentStatus,
  CrossChainDomain,
  PaymentIntent,
  PaymentRequest,
  RoutedPaymentIntent,
} from "../core/types.js";
import { UnsupportedRouteError } from "../core/errors.js";

/**
 * Selects a settlement rail for each payment and executes over it.
 *
 * The engine holds a registry of rails and asks each one whether it serves the requested
 * route. It never inspects `railType` to decide behaviour — that is what keeps adding a new
 * rail additive rather than invasive.
 */
export class PaymentRoutingEngine implements IPaymentRouter {
  private readonly rails: ISettlementRail[] = [];
  private readonly payments = new Map<`0x${string}`, PaymentIntent>();

  constructor(rails: ISettlementRail[] = []) {
    rails.forEach((rail) => this.registerRail(rail));
  }

  registerRail(rail: ISettlementRail): void {
    this.rails.push(rail);
  }

  /** Records an intent the engine did not create, so its status can be queried later. */
  registerPayment(intent: PaymentIntent): void {
    this.payments.set(intent.paymentId, intent);
  }

  async routePayment(request: PaymentRequest): Promise<RoutedPaymentIntent> {
    const rail = this.selectRail(request.sourceDomain, request.destinationDomain);

    const intent: RoutedPaymentIntent = {
      ...request,
      railType: rail.railType,
      status: BridgePaymentStatus.PROCESSING,
      createdAt: new Date(),
    };
    this.payments.set(intent.paymentId, intent);

    try {
      const destinationTxHash = await rail.executeSettlement(intent);

      const settled: RoutedPaymentIntent = {
        ...intent,
        destinationTxHash,
        status: BridgePaymentStatus.COMPLETED,
      };
      this.payments.set(settled.paymentId, settled);

      return settled;
    } catch (err: unknown) {
      this.payments.set(intent.paymentId, {
        ...intent,
        status: BridgePaymentStatus.FAILED,
      });
      throw err;
    }
  }

  async estimateFee(
    source: CrossChainDomain,
    destination: CrossChainDomain,
    amount: bigint
  ): Promise<bigint> {
    return this.selectRail(source, destination).estimateFee(source, destination, amount);
  }

  async getPaymentStatus(paymentId: `0x${string}`): Promise<PaymentIntent | null> {
    return this.payments.get(paymentId) ?? null;
  }

  /** First registered rail that claims the route wins. Registration order is precedence. */
  private selectRail(
    source: CrossChainDomain,
    destination: CrossChainDomain
  ): ISettlementRail {
    const rail = this.rails.find((candidate) => candidate.supportsRoute(source, destination));

    if (!rail) {
      throw new UnsupportedRouteError(source, destination);
    }

    return rail;
  }
}
