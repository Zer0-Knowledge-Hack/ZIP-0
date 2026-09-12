import { IEvmAdapter, ISettlementRail } from "../../core/interfaces.js";
import { CrossChainDomain, PaymentIntent, SettlementRailType } from "../../core/types.js";
import { BridgeError, ErrorCode, InvalidRecipientError } from "../../core/errors.js";

const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;

/**
 * Validates that a recipient is a 20-byte EVM address before funds move.
 *
 * A vault release transfers real USDC, so a malformed recipient must be rejected rather than
 * reshaped. Truncating a non-EVM identifier — a Stellar `G...` address, for example — into
 * something that merely parses as an address sends funds to a key nobody holds, and they
 * cannot be recovered.
 */
function assertEvmAddress(recipient: string): `0x${string}` {
  if (!EVM_ADDRESS.test(recipient)) {
    throw new InvalidRecipientError(recipient, "a 20-byte EVM address (0x + 40 hex characters)");
  }

  return recipient as `0x${string}`;
}

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

    const recipient = assertEvmAddress(intent.destinationRecipient);

    return this.vaultAdapter.releasePayment(intent.paymentId, recipient, intent.amount);
  }
}
