import { formatUnits } from "viem";
import { ISettlementRail } from "../core/interfaces.js";
import { CrossChainDomain, PaymentIntent, SettlementRailType } from "../core/types.js";
import { BridgeError, ErrorCode, InvalidRecipientError } from "../core/errors.js";

/**
 * Circle CCTP domain IDs, keyed by EVM chain ID.
 *
 * Circle domain IDs are NOT chain IDs — Ethereum is domain 0, Avalanche domain 1, and so on.
 * This map is the allow-list for `supportsRoute`; HashKey Chain and Stellar are deliberately
 * absent because Circle does not deploy CCTP on either.
 */
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

/**
 * Circle Bridge Kit chain identifiers, keyed by EVM chain ID. Keys mirror `CCTP_DOMAINS`.
 * Bridge Kit only exposes CCTPv2-capable chains, so this doubles as a capability check.
 */
export const CCTP_BRIDGE_CHAINS: Record<number, string> = {
  1: "Ethereum",
  11155111: "Ethereum_Sepolia",
  43114: "Avalanche",
  43113: "Avalanche_Fuji",
  10: "Optimism",
  11155420: "Optimism_Sepolia",
  42161: "Arbitrum",
  421614: "Arbitrum_Sepolia",
  8453: "Base",
  84532: "Base_Sepolia",
  137: "Polygon",
  80002: "Polygon_Amoy_Testnet",
};

const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;

export interface CctpRailConfig {
  /** FAST pays a small Circle protocol fee for faster finality; SLOW is fee-free. Defaults to SLOW. */
  transferSpeed?: "FAST" | "SLOW";
  /** Optional cap on the Circle protocol fee, human-readable (e.g. "1" for 1 USDC). Only valid with FAST. */
  maxFee?: string;
}

export interface CctpBridgeParams {
  sourceChainId: number;
  destinationChainId: number;
  /** Amount in the token's smallest unit (6 decimals for USDC). */
  amount: bigint;
  recipient: `0x${string}`;
  transferSpeed?: "FAST" | "SLOW";
  maxFee?: string;
}

export interface CctpBridgeStep {
  name: string;
  state: string;
  txHash?: `0x${string}`;
  error?: string;
}

export interface CctpBridgeReceipt {
  sourceTxHash: `0x${string}`;
  destinationTxHash: `0x${string}`;
  steps: CctpBridgeStep[];
}

/**
 * Port for a CCTP provider. Isolating it keeps `CctpSettlementRail` unit-testable without a
 * network, and lets the Circle Bridge Kit implementation be swapped without touching the rail.
 */
export interface CctpBridgeClient {
  bridge(params: CctpBridgeParams): Promise<CctpBridgeReceipt>;
}

/** Minimal structural view of the Bridge Kit, so its types don't leak into the rail. */
interface BridgeKitLike {
  bridge(params: {
    from: { adapter: unknown; chain: string };
    to: { adapter: unknown; chain: string; recipientAddress?: string };
    amount: string;
    config?: { transferSpeed?: "FAST" | "SLOW"; maxFee?: string };
  }): Promise<{
    state: string;
    steps: Array<{ name: string; state: string; txHash?: `0x${string}`; error?: string }>;
  }>;
}

/**
 * CCTP provider backed by Circle's official Bridge Kit (`@circle-fin/bridge-kit`).
 *
 * The kit performs the full burn-and-mint: approve USDC, `depositForBurn` on the source chain,
 * poll Circle's Iris attestation with its own backoff, then `receiveMessage` on the destination.
 * The modules are imported lazily so the rail (and its unit tests) never load the SDK.
 */
export class CircleBridgeKitClient implements CctpBridgeClient {
  constructor(private readonly config: { privateKey: `0x${string}` }) {}

  async bridge(params: CctpBridgeParams): Promise<CctpBridgeReceipt> {
    const bridgeKit = (await import("@circle-fin/bridge-kit")) as unknown as {
      BridgeKit: new () => BridgeKitLike;
    };
    const adapterModule = (await import("@circle-fin/adapter-viem-v2")) as unknown as {
      createViemAdapterFromPrivateKey: (options: { privateKey: `0x${string}` }) => unknown;
    };

    const kit = new bridgeKit.BridgeKit();
    const adapter = adapterModule.createViemAdapterFromPrivateKey({
      privateKey: this.config.privateKey,
    });

    const result = await kit.bridge({
      from: { adapter, chain: bridgeChainName(params.sourceChainId) },
      to: {
        adapter,
        chain: bridgeChainName(params.destinationChainId),
        recipientAddress: params.recipient,
      },
      amount: formatUnits(params.amount, 6),
      config: { transferSpeed: params.transferSpeed ?? "SLOW", maxFee: params.maxFee },
    });

    const burnStep = result.steps.find((step) => step.name === "depositForBurn");
    const mintStep = result.steps.find((step) => step.name === "mint");

    // Never report a destination hash we did not actually receive from a completed mint.
    if (result.state !== "success" || !burnStep?.txHash || !mintStep?.txHash) {
      throw new BridgeError(
        ErrorCode.CCTP_SETTLEMENT_FAILED,
        `CCTP bridge did not complete: state=${result.state}`,
        { steps: result.steps }
      );
    }

    return {
      sourceTxHash: burnStep.txHash,
      destinationTxHash: mintStep.txHash,
      steps: result.steps,
    };
  }
}

/**
 * Settles payments natively over Circle's Cross-Chain Transfer Protocol: USDC is burned on the
 * source chain and minted 1:1 on the destination, with no liquidity pool and no trusted relayer.
 *
 * `supportsRoute` answers honestly: only corridors where both chains have CCTP are served, so the
 * router falls back to the vault rail for HashKey Chain and Stellar.
 */
export class CctpSettlementRail implements ISettlementRail {
  public readonly railType: SettlementRailType = "CCTP_BURN_MINT";

  constructor(
    private readonly bridgeClient?: CctpBridgeClient,
    private readonly config: CctpRailConfig = {}
  ) {}

  public supportsRoute(
    source: CrossChainDomain | number,
    destination: CrossChainDomain | number
  ): boolean {
    const sourceChainId = Number(source);
    const destinationChainId = Number(destination);
    const isSourceSupported = sourceChainId in CCTP_BRIDGE_CHAINS;
    const isDestinationSupported = destinationChainId in CCTP_BRIDGE_CHAINS;
    return isSourceSupported && isDestinationSupported && sourceChainId !== destinationChainId;
  }

  public async estimateFee(
    source: CrossChainDomain | number,
    destination: CrossChainDomain | number,
    _amount: bigint
  ): Promise<bigint> {
    if (!this.supportsRoute(source, destination)) {
      throw new BridgeError(
        ErrorCode.UNSUPPORTED_DOMAIN,
        `CCTP rail does not support corridor ${Number(source)} -> ${Number(destination)}`
      );
    }
    // CCTP has zero slippage and no nominal protocol fee on the SLOW path.
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

    if (!this.bridgeClient) {
      throw new BridgeError(
        ErrorCode.CCTP_NOT_CONFIGURED,
        "CCTP rail has no bridge client configured. Construct it with a CctpBridgeClient (e.g. CircleBridgeKitClient) to settle over CCTP."
      );
    }

    const recipient = assertEvmRecipient(intent.destinationRecipient);

    try {
      const receipt = await this.bridgeClient.bridge({
        sourceChainId,
        destinationChainId,
        amount: intent.amount,
        recipient,
        transferSpeed: this.config.transferSpeed,
        maxFee: this.config.maxFee,
      });
      return receipt.destinationTxHash;
    } catch (err: unknown) {
      if (err instanceof BridgeError) throw err;
      const message = err instanceof Error ? err.message : String(err);
      throw new BridgeError(
        ErrorCode.CCTP_SETTLEMENT_FAILED,
        `CCTP settlement failed: ${message}`,
        err
      );
    }
  }
}

function bridgeChainName(chainId: number): string {
  const name = CCTP_BRIDGE_CHAINS[chainId];
  if (!name) {
    throw new BridgeError(
      ErrorCode.UNSUPPORTED_DOMAIN,
      `No Circle Bridge Kit chain is configured for EVM chain ${chainId}`
    );
  }
  return name;
}

/** CCTP mints to a 20-byte EVM address; anything else is a routing error, not a value to reshape. */
function assertEvmRecipient(recipient: string): `0x${string}` {
  if (!EVM_ADDRESS.test(recipient)) {
    throw new InvalidRecipientError(
      recipient,
      "a 20-byte EVM address (0x + 40 hex characters)"
    );
  }
  return recipient as `0x${string}`;
}
