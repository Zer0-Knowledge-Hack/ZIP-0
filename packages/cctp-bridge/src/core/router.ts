import { IPaymentRouter, ISettlementRail } from "./interfaces.js";
import {
  BridgePaymentStatus,
  PaymentIntent,
  PaymentQuote,
} from "./types.js";
import { BridgeError, ErrorCode } from "./errors.js";

export class PaymentRoutingEngine implements IPaymentRouter {
  private rails: ISettlementRail[] = [];
  private paymentStore = new Map<`0x${string}`, PaymentIntent>();

  constructor(rails: ISettlementRail[] = []) {
    this.rails = [...rails];
  }

  public registerRail(rail: ISettlementRail): void {
    // Avoid duplicate registration
    if (!this.rails.some((r) => r.railType === rail.railType)) {
      this.rails.push(rail);
    }
  }

  public async getQuote(
    sourceChainId: number,
    destinationChainId: number,
    amount: bigint
  ): Promise<PaymentQuote> {
    const rail = this.selectOptimalRail(sourceChainId, destinationChainId);
    if (!rail) {
      throw new BridgeError(
        ErrorCode.UNSUPPORTED_DOMAIN,
        `No supported settlement rail for corridor ${sourceChainId} -> ${destinationChainId}`
      );
    }

    const estimatedFee = await rail.estimateFee(sourceChainId, destinationChainId, amount);

    // CCTP has consensus finality (~15-30s on testnet / L2s), Vault is fast relayer (<5s)
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

  public async routePayment(
    intentInput: Omit<PaymentIntent, "status" | "createdAt" | "railType">
  ): Promise<PaymentIntent> {
    const sourceChainId = intentInput.sourceChainId ?? 0;
    const destinationChainId = intentInput.destinationChainId ?? 0;

    const rail = this.selectOptimalRail(sourceChainId, destinationChainId);
    if (!rail) {
      throw new BridgeError(
        ErrorCode.UNSUPPORTED_DOMAIN,
        `Routing failed: corridor ${sourceChainId} -> ${destinationChainId} is not supported by any registered rail.`
      );
    }

    const intent: PaymentIntent = {
      ...intentInput,
      railType: rail.railType,
      status: BridgePaymentStatus.PROCESSING,
      createdAt: new Date(),
    };

    this.paymentStore.set(intent.paymentId, intent);

    try {
      const txHash = await rail.executeSettlement(intent);
      intent.destinationTxHash = txHash;
      intent.status = BridgePaymentStatus.COMPLETED;
      this.paymentStore.set(intent.paymentId, intent);
      return intent;
    } catch (err: unknown) {
      intent.status = BridgePaymentStatus.FAILED;
      this.paymentStore.set(intent.paymentId, intent);
      const message = err instanceof Error ? err.message : String(err);
      throw new BridgeError(
        ErrorCode.PAYMENT_RELEASE_FAILED,
        `Settlement failed on rail ${rail.railType}: ${message}`
      );
    }
  }

  public async getPaymentStatus(paymentId: `0x${string}`): Promise<PaymentIntent | null> {
    return this.paymentStore.get(paymentId) ?? null;
  }

  private selectOptimalRail(
    sourceChainId: number,
    destinationChainId: number
  ): ISettlementRail | null {
    // Strategy: Prefer native CCTP (1:1 Burn & Mint, zero liquidity pool) whenever available
    const cctpRail = this.rails.find(
      (r) => r.railType === "CCTP_BURN_MINT" && r.supportsRoute(sourceChainId, destinationChainId)
    );
    if (cctpRail) {
      return cctpRail;
    }

    // Fallback: Vault Rail for non-CCTP networks (HSK, etc.)
    const vaultRail = this.rails.find(
      (r) => r.railType === "LIQUIDITY_VAULT" && r.supportsRoute(sourceChainId, destinationChainId)
    );
    return vaultRail ?? null;
  }
}
