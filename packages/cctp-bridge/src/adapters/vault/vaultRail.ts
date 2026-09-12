import { IEvmAdapter, ISettlementRail } from "../../core/interfaces.js";
import { CrossChainDomain, PaymentIntent, SettlementRailType } from "../../core/types.js";
import { BridgeError, ErrorCode } from "../../core/errors.js";

export class VaultSettlementRail implements ISettlementRail {
  public readonly railType: SettlementRailType = "LIQUIDITY_VAULT";
  private vaultAdapter: IEvmAdapter;
  private supportedChains: Set<number>;

  constructor(vaultAdapter: IEvmAdapter, supportedChains: number[] = [133, 10133, 31337, 43113]) {
    this.vaultAdapter = vaultAdapter;
    this.supportedChains = new Set(supportedChains);
  }

  public supportsRoute(
    source: CrossChainDomain | number,
    destination: CrossChainDomain | number
  ): boolean {
    const sourceChainId = Number(source);
    const destinationChainId = Number(destination);
    // Supports routes that touch any configured vault chain
    return (
      (this.supportedChains.has(sourceChainId) || this.supportedChains.has(destinationChainId)) &&
      sourceChainId !== destinationChainId
    );
  }

  public async estimateFee(
    _source: CrossChainDomain | number,
    _destination: CrossChainDomain | number,
    amount: bigint
  ): Promise<bigint> {
    // 10 bps (0.10%) relayer float fee for private liquidity pool
    return (amount * 10n) / 10000n;
  }

  public async executeSettlement(
    intent: PaymentIntent,
    _authorizationSignature?: `0x${string}`
  ): Promise<`0x${string}`> {
    if (intent.amount <= 0n) {
      throw new BridgeError(ErrorCode.INVALID_AMOUNT, "Amount must be strictly positive");
    }

    // Check available vault balance before release
    const currentBalance = await this.vaultAdapter.getVaultBalance();
    if (currentBalance < intent.amount) {
      throw new BridgeError(
        ErrorCode.INSUFFICIENT_VAULT_BALANCE,
        `Vault has insufficient liquidity. Available: ${currentBalance}, Required: ${intent.amount}`
      );
    }

    const recipient = (
      intent.destinationRecipient.startsWith("0x")
        ? intent.destinationRecipient
        : `0x${intent.destinationRecipient.slice(0, 40)}`
    ) as `0x${string}`;

    return this.vaultAdapter.releasePayment(intent.paymentId, recipient, intent.amount);
  }
}
