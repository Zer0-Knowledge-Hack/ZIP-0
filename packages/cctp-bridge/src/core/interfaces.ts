import { PaymentIntent } from "./types.js";

export interface IEvmAdapter {
  depositPayment(intent: Omit<PaymentIntent, "status" | "createdAt">): Promise<`0x${string}`>;
  releasePayment(paymentId: `0x${string}`, recipient: `0x${string}`, amount: bigint): Promise<`0x${string}`>;
  getVaultBalance(): Promise<bigint>;
  onPaymentInitiated(callback: (intent: PaymentIntent) => Promise<void>): () => void;
}

export interface IStellarAdapter {
  creditPayment(recipient: string, amount: bigint, referenceId: string): Promise<string>;
  onPaymentReceived(callback: (payment: { referenceId: string; amount: bigint; sender: string }) => Promise<void>): () => void;
  getBalance(accountId: string): Promise<bigint>;
}

export interface IRelayerOrchestrator {
  handleHskToStellar(intent: PaymentIntent): Promise<void>;
  handleStellarToHsk(payment: { referenceId: string; amount: bigint; destinationHskAddress: `0x${string}` }): Promise<`0x${string}`>;
  getPaymentStatus(paymentId: `0x${string}`): Promise<PaymentIntent | null>;
}
