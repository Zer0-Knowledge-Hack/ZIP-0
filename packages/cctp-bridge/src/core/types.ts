export enum CrossChainDomain {
  AVALANCHE = 1,
  STELLAR = 21,
  HASHKEY_CHAIN = 10133,
}

export enum BridgePaymentStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  RELAYED = "RELAYED",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

/**
 * Settlement mechanisms ZIP-0 can route a payment over.
 *
 * `CCTP_BURN_MINT` settles 1:1 through Circle's burn-and-mint with no liquidity pool.
 * `LIQUIDITY_VAULT` locks on the source chain and releases from vault float on the destination.
 */
export type SettlementRailType = "CCTP_BURN_MINT" | "LIQUIDITY_VAULT";

export interface PaymentIntent {
  paymentId: `0x${string}`;
  amount: bigint;
  sourceDomain: CrossChainDomain;
  destinationDomain: CrossChainDomain;
  sourcePayer: string;
  destinationRecipient: string;
  metadata?: Record<string, unknown>;
  status: BridgePaymentStatus;
  createdAt: Date;
  sourceTxHash?: string;
  destinationTxHash?: string;
  /**
   * Which rail settled this payment. Optional on the type so that intents constructed
   * outside the router stay valid; `PaymentRoutingEngine` always populates it and returns
   * the narrower `RoutedPaymentIntent`.
   */
  railType?: SettlementRailType;
}

/**
 * A payment intent whose rail has been decided. Returned by the router so callers get a
 * compile-time guarantee that `railType` is present.
 */
export type RoutedPaymentIntent = PaymentIntent & { railType: SettlementRailType };

/**
 * What a caller supplies to request a payment. Status, timestamps and rail selection are
 * decided by the router, not by the caller.
 */
export type PaymentRequest = Omit<
  PaymentIntent,
  "status" | "createdAt" | "railType" | "sourceTxHash" | "destinationTxHash"
>;

export interface EvmVaultConfig {
  rpcUrl: string;
  chainId: number;
  vaultAddress: `0x${string}`;
  usdcAddress: `0x${string}`;
  relayerPrivateKey?: `0x${string}`;
}

export type HskVaultConfig = EvmVaultConfig;

export interface PollarConfig {
  appId: string;
  publishableKey?: string;
  secretKey?: string;
  horizonUrl: string;
  networkPassphrase?: string;
}
