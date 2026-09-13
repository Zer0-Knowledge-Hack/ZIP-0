import { IEvmAdapter, IRelayerOrchestrator, IStellarAdapter } from "../core/interfaces.js";
import { InMemoryPaymentStore } from "../core/in-memory-payment-store.js";
import { PaymentStore } from "../core/payment-store.js";
import { BridgePaymentStatus, CrossChainDomain, PaymentIntent } from "../core/types.js";
import { PaymentRoutingEngine } from "../routing/payment-routing-engine.js";
import { VaultSettlementRail } from "../rails/vault-settlement-rail.js";

/**
 * Backwards-compatible facade over {@link PaymentRoutingEngine}.
 *
 * Settlement logic now lives in {@link VaultSettlementRail}; this class only adapts the
 * original two-method API onto the router. Payment tracking goes through {@link PaymentStore}
 * so a durable implementation can recover state after a process restart.
 */
export class RelayerOrchestrator implements IRelayerOrchestrator {
  private readonly router: PaymentRoutingEngine;
  private readonly paymentStore: PaymentStore;

  constructor(
    private readonly evmAdapter: IEvmAdapter,
    private readonly stellarAdapter: IStellarAdapter,
    router?: PaymentRoutingEngine,
    paymentStore: PaymentStore = new InMemoryPaymentStore()
  ) {
    this.router =
      router ?? new PaymentRoutingEngine([new VaultSettlementRail(evmAdapter, stellarAdapter)]);
    this.paymentStore = paymentStore;
  }

  /** Exposes the underlying router so callers can migrate incrementally. */
  get paymentRouter(): PaymentRoutingEngine {
    return this.router;
  }

  async registerPayment(intent: PaymentIntent): Promise<void> {
    this.router.registerPayment(intent);
    await this.paymentStore.set(intent);
  }

  async getPaymentStatus(paymentId: `0x${string}`): Promise<PaymentIntent | null> {
    return (await this.paymentStore.get(paymentId)) ?? this.router.getPaymentStatus(paymentId);
  }

  /**
   * Flow 1: EVM -> Stellar.
   * Mutates the caller's intent in place, as the original implementation did.
   */
  async handleHskToStellar(intent: PaymentIntent): Promise<void> {
    const settled = await this.persistThroughRoute(intent, () =>
      this.router.routePayment({
        paymentId: intent.paymentId,
        amount: intent.amount,
        sourceDomain: intent.sourceDomain,
        destinationDomain: intent.destinationDomain,
        sourcePayer: intent.sourcePayer,
        destinationRecipient: intent.destinationRecipient,
        metadata: intent.metadata,
      })
    );

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

    const settled = await this.persistThroughRoute(
      {
        paymentId,
        amount: payment.amount,
        sourceDomain: CrossChainDomain.STELLAR,
        destinationDomain: CrossChainDomain.HASHKEY_CHAIN,
        sourcePayer: "stellar-pollar",
        destinationRecipient: payment.destinationHskAddress,
        status: BridgePaymentStatus.PENDING,
        createdAt: new Date(),
      },
      () =>
        this.router.routePayment({
          paymentId,
          amount: payment.amount,
          sourceDomain: CrossChainDomain.STELLAR,
          destinationDomain: CrossChainDomain.HASHKEY_CHAIN,
          sourcePayer: "stellar-pollar",
          destinationRecipient: payment.destinationHskAddress,
        })
    );

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

  /**
   * Records PROCESSING, then COMPLETED or FAILED, so a restart can see the last
   * persisted transition rather than only the initial insert.
   */
  private async persistThroughRoute(
    seed: PaymentIntent,
    settle: () => Promise<PaymentIntent>
  ): Promise<PaymentIntent> {
    await this.paymentStore.set({
      ...seed,
      status: BridgePaymentStatus.PROCESSING,
    });

    try {
      const settled = await settle();
      await this.paymentStore.set(settled);
      return settled;
    } catch (err: unknown) {
      await this.paymentStore.set({
        ...seed,
        status: BridgePaymentStatus.FAILED,
      });
      throw err;
    }
  }
}
