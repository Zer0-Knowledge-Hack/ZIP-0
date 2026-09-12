import { IPaymentRouter, ISettlementRail } from "../core/interfaces.js";
import {
  BridgePaymentStatus,
  CrossChainDomain,
  PaymentIntent,
  PaymentQuote,
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

  async getQuote(
    sourceChainId: number,
    destinationChainId: number,
    amount: bigint
  ): Promise<PaymentQuote> {
    const rail = this.selectRail(sourceChainId, destinationChainId);
    const estimatedFee = await rail.estimateFee(sourceChainId, destinationChainId, amount);
    const estimatedFinalitySeconds = rail.railType === "CCTP_BURN_MINT" ? 20 : 5;

    return {
      sourceChainId,
      destinationChainId,
      amount,
      estimatedFee,
      railType: rail.railType,
      estimatedFinalitySeconds,
    };
  }

  async routePayment(
    request: PaymentRequest | Omit<PaymentIntent, "status" | "createdAt" | "railType">
  ): Promise<RoutedPaymentIntent> {
    const source = request.sourceChainId ?? request.sourceDomain;
    const destination = request.destinationChainId ?? request.destinationDomain;

    const rail = this.selectRail(source, destination);

    const intent: RoutedPaymentIntent = {
      ...request,
      sourceDomain: request.sourceDomain ?? (source as CrossChainDomain),
      destinationDomain: request.destinationDomain ?? (destination as CrossChainDomain),
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
    source: CrossChainDomain | number,
    destination: CrossChainDomain | number,
    amount: bigint
  ): Promise<bigint> {
    return this.selectRail(source, destination).estimateFee(source, destination, amount);
  }

  async getPaymentStatus(paymentId: `0x${string}`): Promise<PaymentIntent | null> {
    return this.payments.get(paymentId) ?? null;
  }

  /** First registered rail that claims the route wins. Registration order is precedence. */
  private selectRail(
    source: CrossChainDomain | number,
    destination: CrossChainDomain | number
  ): ISettlementRail {
    const rail = this.rails.find((candidate) => candidate.supportsRoute(source, destination));

    if (!rail) {
      throw new UnsupportedRouteError(Number(source), Number(destination));
    }

    return rail;
  }
}
