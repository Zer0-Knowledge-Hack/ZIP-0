import { BridgePaymentStatus, PaymentIntent } from "./types.js";

/**
 * Persistence boundary for payment tracking.
 *
 * The relayer records each intent here so status can be recovered after a process
 * restart. Implementations may be ephemeral (tests) or durable (real runs).
 */
export interface PaymentStore {
  get(paymentId: `0x${string}`): Promise<PaymentIntent | null>;
  set(intent: PaymentIntent): Promise<void>;
  list(): Promise<PaymentIntent[]>;
  findByStatus(status: BridgePaymentStatus): Promise<PaymentIntent[]>;
}
