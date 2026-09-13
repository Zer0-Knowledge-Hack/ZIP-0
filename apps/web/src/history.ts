export type StoredPayment = {
  paymentId: string;
  status: string;
  amount: string;
  sourceChain: string;
  destinationChain: string;
  destinationRecipient: string;
  destinationTxHash?: string;
  createdAt: string;
};

const KEY = "zip0-payments";

export function loadPayments(): StoredPayment[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isStoredPayment);
  } catch {
    return [];
  }
}

export function savePayment(payment: StoredPayment): StoredPayment[] {
  const next = [payment, ...loadPayments().filter((item) => item.paymentId !== payment.paymentId)];
  try {
    localStorage.setItem(KEY, JSON.stringify(next.slice(0, 40)));
  } catch {
    /* Storage may be disabled. */
  }
  return next;
}

function isStoredPayment(value: unknown): value is StoredPayment {
  if (typeof value !== "object" || value === null) return false;
  const item = value as StoredPayment;
  return (
    typeof item.paymentId === "string" &&
    typeof item.status === "string" &&
    typeof item.amount === "string" &&
    typeof item.sourceChain === "string" &&
    typeof item.destinationChain === "string"
  );
}

export function statusTone(status: string): "draft" | "pending" | "done" | "fail" {
  const key = status.toUpperCase();
  if (key === "COMPLETED") return "done";
  if (key === "FAILED") return "fail";
  if (key === "PENDING" || key === "PROCESSING") return "pending";
  return "draft";
}
