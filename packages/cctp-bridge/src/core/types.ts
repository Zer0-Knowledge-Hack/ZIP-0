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
