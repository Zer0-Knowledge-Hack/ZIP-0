import { IEvmAdapter, ISettlementRail, IStellarAdapter } from "../core/interfaces.js";
import { CrossChainDomain, PaymentIntent, SettlementRailType } from "../core/types.js";
import {
  InsufficientVaultLiquidityError,
  RelayerExecutionError,
  UnsupportedRouteError,
} from "../core/errors.js";
import { PollarStellarAdapter } from "../adapters/pollar/client.js";

/** Domains served by an EVM vault deployment. */
const EVM_DOMAINS: readonly CrossChainDomain[] = [
  CrossChainDomain.HASHKEY_CHAIN,
  CrossChainDomain.AVALANCHE,
];

const isEvm = (domain: CrossChainDomain): boolean => EVM_DOMAINS.includes(domain);
const isStellar = (domain: CrossChainDomain): boolean => domain === CrossChainDomain.STELLAR;

/**
 * Settles payments by locking USDC in a vault on the source chain and releasing vault float
 * on the destination chain.
 *
 * This rail carries the behaviour that previously lived directly in `RelayerOrchestrator`.
 * It assumes an honest relayer: releases are authorized by `RELAYER_ROLE`, not by an
 * on-chain proof of the source-side credit. See `docs/project-status.md`.
 */
export class VaultSettlementRail implements ISettlementRail {
  readonly railType: SettlementRailType = "LIQUIDITY_VAULT";

  constructor(
    private readonly evmAdapter: IEvmAdapter,
    private readonly stellarAdapter: IStellarAdapter
  ) {}

  supportsRoute(source: CrossChainDomain, destination: CrossChainDomain): boolean {
    return (
      (isEvm(source) && isStellar(destination)) || (isStellar(source) && isEvm(destination))
    );
  }

  /** Vault settlement charges no bridge fee today; the payer covers only chain gas. */
  async estimateFee(): Promise<bigint> {
    return 0n;
  }

  async executeSettlement(intent: PaymentIntent): Promise<string> {
    if (!this.supportsRoute(intent.sourceDomain, intent.destinationDomain)) {
      throw new UnsupportedRouteError(intent.sourceDomain, intent.destinationDomain);
    }

    return isStellar(intent.destinationDomain)
      ? this.settleToStellar(intent)
      : this.settleToEvm(intent);
  }

  /**
   * EVM -> Stellar: funds are already locked in the vault; credit the Stellar recipient.
   *
   * Acknowledge first, credit second. Acknowledging moves the deposit out of INITIATED, so the
   * payer can no longer `claimRefund` it. If the credit then fails, the deposit stays
   * ACKNOWLEDGED and the relayer can still return it with `refundPayment`. The reverse order
   * leaves a window — a crash between credit and acknowledgement — in which the payer is
   * credited on Stellar and can still reclaim the deposit once REFUND_TIMEOUT passes.
   */
  private async settleToStellar(intent: PaymentIntent): Promise<string> {
    const recipient = this.resolveStellarAddress(intent.destinationRecipient);

    try {
      await this.evmAdapter.acknowledgePayment(intent.paymentId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new RelayerExecutionError(
        `Failed acknowledging deposit in the EVM vault; Stellar was not credited: ${message}`,
        err
      );
    }

    try {
      return await this.stellarAdapter.creditPayment(recipient, intent.amount, intent.paymentId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new RelayerExecutionError(
        `Failed crediting Stellar recipient; deposit ${intent.paymentId} is ACKNOWLEDGED and ` +
          `must be returned with refundPayment: ${message}`,
        err
      );
    }
  }

  /** Stellar -> EVM: the Stellar leg is settled; release vault float on the EVM side. */
  private async settleToEvm(intent: PaymentIntent): Promise<string> {
    const available = await this.evmAdapter.getVaultBalance();

    if (available < intent.amount) {
      throw new InsufficientVaultLiquidityError(intent.amount, available);
    }

    try {
      return await this.evmAdapter.releasePayment(
        intent.paymentId,
        intent.destinationRecipient as `0x${string}`,
        intent.amount
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new RelayerExecutionError(`Failed releasing payment in EVM: ${message}`, err);
    }
  }

  /** Stellar recipients may arrive as a G-address or bytes32-encoded for on-chain storage. */
  private resolveStellarAddress(recipient: string): string {
    const isBytes32 = recipient.startsWith("0x") && recipient.length === 66;

    return isBytes32
      ? PollarStellarAdapter.bytes32ToStellarAddress(recipient as `0x${string}`)
      : recipient;
  }
}
