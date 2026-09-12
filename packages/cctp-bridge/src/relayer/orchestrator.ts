import { IEvmAdapter, IRelayerOrchestrator, IStellarAdapter } from "../core/interfaces.js";
import { CrossChainDomain, PaymentIntent } from "../core/types.js";
import { PaymentRoutingEngine } from "../routing/payment-routing-engine.js";
import { VaultSettlementRail } from "../rails/vault-settlement-rail.js";

/**
 * Backwards-compatible facade over {@link PaymentRoutingEngine}.
 *
 * Settlement logic now lives in {@link VaultSettlementRail}; this class only adapts the
 * original two-method API onto the router. New code should depend on `IPaymentRouter`
 * instead — this facade exists so existing callers keep working through the refactor.
 */
export class RelayerOrchestrator implements IRelayerOrchestrator {
  private readonly router: PaymentRoutingEngine;

  constructor(
    private readonly evmAdapter: IEvmAdapter,
    private readonly stellarAdapter: IStellarAdapter,
    router?: PaymentRoutingEngine
  ) {
    this.router =
      router ?? new PaymentRoutingEngine([new VaultSettlementRail(evmAdapter, stellarAdapter)]);
  }

  /** Exposes the underlying router so callers can migrate incrementally. */
  get paymentRouter(): PaymentRoutingEngine {
    return this.router;
  }

  registerPayment(intent: PaymentIntent): void {
    this.router.registerPayment(intent);
  }

  async getPaymentStatus(paymentId: `0x${string}`): Promise<PaymentIntent | null> {
    return this.router.getPaymentStatus(paymentId);
  }

  /**
   * Flow 1: EVM -> Stellar.
   * Mutates the caller's intent in place, as the original implementation did.
   */
  async handleHskToStellar(intent: PaymentIntent): Promise<void> {
    const settled = await this.router.routePayment({
      paymentId: intent.paymentId,
      amount: intent.amount,
      sourceDomain: intent.sourceDomain,
      destinationDomain: intent.destinationDomain,
      sourcePayer: intent.sourcePayer,
      destinationRecipient: intent.destinationRecipient,
      metadata: intent.metadata,
    });

    intent.destinationTxHash = settled.destinationTxHash;
    intent.status = settled.status;
    intent.railType = settled.railType;
  }

  /**
   * Flow 2: Stellar -> EVM.
   */
  async handleStellarToHsk(payment: {
    referenceId: string;
    amount: bigint;
    destinationHskAddress: `0x${string}`;
  }): Promise<`0x${string}`> {
    const paymentId = (
      payment.referenceId.startsWith("0x") ? payment.referenceId : `0x${payment.referenceId}`
    ) as `0x${string}`;

    const settled = await this.router.routePayment({
      paymentId,
      amount: payment.amount,
      sourceDomain: CrossChainDomain.STELLAR,
      destinationDomain: CrossChainDomain.HASHKEY_CHAIN,
      sourcePayer: "stellar-pollar",
      destinationRecipient: payment.destinationHskAddress,
    });

    return settled.destinationTxHash as `0x${string}`;
  }

  /** Alias for Flow 1, kept for callers that speak in generic EVM terms. */
  async handleEvmToStellar(intent: PaymentIntent): Promise<void> {
    return this.handleHskToStellar(intent);
  }

  /** Alias for Flow 2. */
  async handleStellarToEvm(payment: {
    referenceId: string;
    amount: bigint;
    destinationEvmAddress: `0x${string}`;
  }): Promise<`0x${string}`> {
    return this.handleStellarToHsk({
      referenceId: payment.referenceId,
      amount: payment.amount,
      destinationHskAddress: payment.destinationEvmAddress,
    });
  }
}
