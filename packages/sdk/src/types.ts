export type SupportedChain =
  | "avalanche"
  | "hashkey"
  | "stellar"
  | "ethereum"
  | "polygon"
  | "arbitrum"
  | "base"
  | (string & {});

export interface Zip0ClientConfig {
  apiKey?: string;
  baseUrl?: string;
  fetch?: typeof fetch;
}

export interface PaymentQuoteParams {
  sourceChain: SupportedChain;
  destinationChain: SupportedChain;
  amount: string;
}

export interface PaymentQuoteResult {
  sourceChain: string;
  destinationChain: string;
  sourceChainId: number;
  destinationChainId: number;
  amount: string;
  estimatedFee: string;
  railType: string;
  estimatedFinalitySeconds: number;
}

export interface AuthorizationPayload {
  from: `0x${string}`;
  to: `0x${string}`;
  value: string;
  validAfter: number;
  validBefore: number;
  nonce: `0x${string}`;
  v: number;
  r: `0x${string}`;
  s: `0x${string}`;
}

export interface CreatePaymentParams {
  amount: string;
  sourceChain: SupportedChain;
  destinationChain: SupportedChain;
  recipient: string;
  payer?: string;
  reference?: string;
  authorization?: AuthorizationPayload;
  metadata?: Record<string, unknown>;
}

export type PaymentStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface PaymentRecord {
  paymentId: `0x${string}`;
  status: PaymentStatus;
  sourceChain?: string;
  destinationChain?: string;
  amount?: string;
  destinationRecipient?: string;
  sourceTxHash?: string;
  destinationTxHash?: string;
  railType?: string;
  createdAt?: string;
}

export interface WebhookSubscribeParams {
  url: string;
  secret: string;
  events?: string[];
}

export interface WebhookSubscribeResult {
  id: string;
  url: string;
  status: string;
}
