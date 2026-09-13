import { PaymentStore } from "./payment-store.js";
import { BridgePaymentStatus, PaymentIntent } from "./types.js";

/**
 * Process-local store used by tests and as the orchestrator default.
 * Encapsulates the `Map` that previously lived on the payment tracker.
 */
export class InMemoryPaymentStore implements PaymentStore {
  private readonly payments = new Map<`0x${string}`, PaymentIntent>();

  async get(paymentId: `0x${string}`): Promise<PaymentIntent | null> {
    const found = this.payments.get(paymentId);
    return found ? { ...found } : null;
  }

  async set(intent: PaymentIntent): Promise<void> {
    this.payments.set(intent.paymentId, { ...intent });
  }

  async list(): Promise<PaymentIntent[]> {
    return Array.from(this.payments.values()).map((intent) => ({ ...intent }));
  }

  async findByStatus(status: BridgePaymentStatus): Promise<PaymentIntent[]> {
    return (await this.list()).filter((intent) => intent.status === status);
  }
}
