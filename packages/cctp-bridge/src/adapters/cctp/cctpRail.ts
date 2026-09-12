import { ISettlementRail } from "../../core/interfaces.js";
import { CrossChainDomain, PaymentIntent, SettlementRailType } from "../../core/types.js";
import { BridgeError, ErrorCode, NotImplementedError } from "../../core/errors.js";

// Circle CCTP Domain IDs mapping
export const CCTP_DOMAINS: Record<number, number> = {
  1: 0, // Ethereum Mainnet
  11155111: 0, // Sepolia
  43114: 1, // Avalanche C-Chain
  43113: 1, // Avalanche Fuji
  10: 2, // OP Mainnet
  11155420: 2, // OP Sepolia
  42161: 3, // Arbitrum One
  421614: 3, // Arbitrum Sepolia
  8453: 6, // Base
  84532: 6, // Base Sepolia
  137: 7, // Polygon PoS
  80002: 7, // Polygon Amoy
};

export interface CctpRailConfig {
  attestationApiUrl?: string;
  relayerSigner?: `0x${string}`;
}

export class CctpSettlementRail implements ISettlementRail {
  public readonly railType: SettlementRailType = "CCTP_BURN_MINT";
  private config: CctpRailConfig;

  constructor(config: CctpRailConfig = {}) {
    this.config = config;
  }

  public supportsRoute(
    source: CrossChainDomain | number,
    destination: CrossChainDomain | number
  ): boolean {
    const sourceChainId = Number(source);
    const destinationChainId = Number(destination);
    const isSourceSupported = sourceChainId in CCTP_DOMAINS;
    const isDestSupported = destinationChainId in CCTP_DOMAINS;
    return isSourceSupported && isDestSupported && sourceChainId !== destinationChainId;
  }

  public async estimateFee(
    source: CrossChainDomain | number,
    destination: CrossChainDomain | number,
    _amount: bigint
  ): Promise<bigint> {
    const sourceChainId = Number(source);
    const destinationChainId = Number(destination);
    if (!this.supportsRoute(sourceChainId, destinationChainId)) {
      throw new BridgeError(
        ErrorCode.UNSUPPORTED_DOMAIN,
        `CCTP rail does not support corridor ${sourceChainId} -> ${destinationChainId}`
      );
    }
    // Circle CCTP has ZERO protocol slippage and zero nominal protocol fee
    return 0n;
  }

  public async executeSettlement(
    intent: PaymentIntent,
    _authorizationSignature?: `0x${string}`
  ): Promise<`0x${string}`> {
    const sourceChainId = intent.sourceChainId ?? 0;
    const destinationChainId = intent.destinationChainId ?? 0;

    if (!this.supportsRoute(sourceChainId, destinationChainId)) {
      throw new BridgeError(
        ErrorCode.UNSUPPORTED_DOMAIN,
        `Cannot execute CCTP settlement: route ${sourceChainId} -> ${destinationChainId} is unsupported.`
      );
    }

    if (intent.amount <= 0n) {
      throw new BridgeError(ErrorCode.INVALID_AMOUNT, "Amount must be strictly positive");
    }

    // Remaining protocol work, tracked in issue #14:
    //   1. TokenMessenger.depositForBurn on the source chain
    //   2. Poll Circle's Iris attestation API with backoff
    //   3. MessageTransmitter.receiveMessage on the destination chain
    //
    // Until those land there is no transaction to report. Returning a synthetic hash here
    // would mark the payment COMPLETED for a settlement that never happened.
    throw new NotImplementedError(
      `CCTP settlement (${sourceChainId} -> ${destinationChainId})`,
      "Route this corridor over the vault rail, or implement depositForBurn/attestation/receiveMessage first."
    );
  }
}
