export enum CrossChainDomain {
  AVALANCHE = 1,
  STELLAR = 21,
  HASHKEY_CHAIN = 10133,
  POLYGON = 7,
  ARBITRUM = 3,
  BASE = 6,
  ETHEREUM = 0,
}

export type SettlementRailType = "CCTP_BURN_MINT" | "LIQUIDITY_VAULT";

export enum BridgePaymentStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  RELAYED = "RELAYED",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

export interface AuthorizationPayload {
  from: `0x${string}`;
  to: `0x${string}`;
  value: bigint;
  validAfter: number;
  validBefore: number;
  nonce: `0x${string}`;
  v: number;
  r: `0x${string}`;
  s: `0x${string}`;
}

export interface PaymentIntent {
  paymentId: `0x${string}`;
  amount: bigint;
  sourceDomain: CrossChainDomain;
  destinationDomain: CrossChainDomain;
  sourceChainId?: number;
  destinationChainId?: number;
  sourcePayer: string;
  destinationRecipient: string;
  railType?: SettlementRailType;
  authorization?: AuthorizationPayload;
  metadata?: Record<string, unknown>;
  status: BridgePaymentStatus;
  createdAt: Date;
  sourceTxHash?: string;
  destinationTxHash?: string;
}

export interface PaymentQuote {
  sourceChainId: number;
  destinationChainId: number;
  amount: bigint;
  estimatedFee: bigint;
  railType: SettlementRailType;
  estimatedFinalitySeconds: number;
}

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
