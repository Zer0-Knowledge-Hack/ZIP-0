import { IEvmAdapter, IStellarAdapter, IRelayerOrchestrator } from "../core/interfaces.js";
import { BridgePaymentStatus, CrossChainDomain, PaymentIntent } from "../core/types.js";
import { RelayerExecutionError } from "../core/errors.js";
import { PollarStellarAdapter } from "../adapters/pollar/client.js";

export class RelayerOrchestrator implements IRelayerOrchestrator {
  private payments = new Map<`0x${string}`, PaymentIntent>();

  constructor(
    private readonly evmAdapter: IEvmAdapter,
    private readonly stellarAdapter: IStellarAdapter
  ) {}

  registerPayment(intent: PaymentIntent): void {
    this.payments.set(intent.paymentId, intent);
  }

  async getPaymentStatus(paymentId: `0x${string}`): Promise<PaymentIntent | null> {
    return this.payments.get(paymentId) || null;
  }

  /**
   * Flow 1: EVM -> Stellar (Pollar)
   */
  async handleHskToStellar(intent: PaymentIntent): Promise<void> {
    intent.status = BridgePaymentStatus.PROCESSING;
    this.payments.set(intent.paymentId, intent);

    try {
      // Decode Stellar destination address if encoded as bytes32
      const destinationStellarAddress =
        intent.destinationRecipient.startsWith("0x") && intent.destinationRecipient.length === 66
          ? PollarStellarAdapter.bytes32ToStellarAddress(intent.destinationRecipient as `0x${string}`)
          : intent.destinationRecipient;

      const stellarTxHash = await this.stellarAdapter.creditPayment(
        destinationStellarAddress,
        intent.amount,
        intent.paymentId
      );

      intent.destinationTxHash = stellarTxHash;
      intent.status = BridgePaymentStatus.COMPLETED;
      this.payments.set(intent.paymentId, intent);
    } catch (err: unknown) {
      intent.status = BridgePaymentStatus.FAILED;
      this.payments.set(intent.paymentId, intent);
      const message = err instanceof Error ? err.message : String(err);
      throw new RelayerExecutionError(`Failed processing HSK->Stellar payment: ${message}`, err);
    }
  }

  /**
   * Flow 2: Stellar (Pollar) -> HSK
   */
  async handleStellarToHsk(payment: {
    referenceId: string;
    amount: bigint;
    destinationHskAddress: `0x${string}`;
  }): Promise<`0x${string}`> {
    const paymentId = (payment.referenceId.startsWith("0x")
      ? payment.referenceId
      : `0x${payment.referenceId}`) as `0x${string}`;

    const intent: PaymentIntent = {
      paymentId,
      amount: payment.amount,
      sourceDomain: CrossChainDomain.STELLAR,
      destinationDomain: CrossChainDomain.HASHKEY_CHAIN,
      sourcePayer: "stellar-pollar",
      destinationRecipient: payment.destinationHskAddress,
      status: BridgePaymentStatus.PROCESSING,
      createdAt: new Date(),
    };
    this.payments.set(paymentId, intent);

    // Verify vault liquidity
    const vaultBalance = await this.evmAdapter.getVaultBalance();
    if (vaultBalance < payment.amount) {
      intent.status = BridgePaymentStatus.FAILED;
      throw new RelayerExecutionError(
        `Insufficient liquidity in HSK Vault. Needed ${payment.amount}, available ${vaultBalance}`
      );
    }

    try {
      const txHash = await this.evmAdapter.releasePayment(
        paymentId,
        payment.destinationHskAddress,
        payment.amount
      );

      intent.destinationTxHash = txHash;
      intent.status = BridgePaymentStatus.COMPLETED;
      this.payments.set(paymentId, intent);

      return txHash;
    } catch (err: unknown) {
      intent.status = BridgePaymentStatus.FAILED;
      const message = err instanceof Error ? err.message : String(err);
      throw new RelayerExecutionError(`Failed releasing payment in EVM: ${message}`, err);
    }
  }

  /**
   * Alias for Flow 1: EVM -> Stellar
   */
  async handleEvmToStellar(intent: PaymentIntent): Promise<void> {
    return this.handleHskToStellar(intent);
  }

  /**
   * Alias for Flow 2: Stellar -> EVM
   */
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
