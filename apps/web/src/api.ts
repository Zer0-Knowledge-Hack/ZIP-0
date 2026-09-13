export type QuoteResult = {
  sourceChain: string;
  destinationChain: string;
  amount: string;
  estimatedFee: string;
  railType: string;
  estimatedFinalitySeconds: number;
};

export type TransferResult = {
  paymentId: string;
  status: string;
  sourceChain: string;
  destinationChain: string;
  amount: string;
  destinationRecipient: string;
  destinationTxHash?: string;
  railType?: string;
  createdAt?: string;
};

export type ApiErrorKind = "quoteError" | "quoteNetworkError" | "sendError";

async function readBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function fetchQuote(input: {
  sourceChain: string;
  destinationChain: string;
  amount: string;
}): Promise<QuoteResult> {
  let response: Response;
  try {
    response = await fetch("/v1/payments/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    throw new Error("quoteNetworkError");
  }
  const body = (await readBody(response)) as QuoteResult & { error?: string };
  if (!response.ok) throw new Error("quoteError");
  return body;
}

export async function createTransfer(input: {
  sourceChain: string;
  destinationChain: string;
  amount: string;
  recipient: string;
  payer?: string;
  reference?: string;
}): Promise<TransferResult> {
  let response: Response;
  try {
    response = await fetch("/v1/payments/transfer", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    throw new Error("sendError");
  }
  const body = (await readBody(response)) as TransferResult & { error?: string };
  if (!response.ok) throw new Error("sendError");
  return body;
}

export async function fetchPayment(paymentId: string): Promise<TransferResult | null> {
  try {
    const response = await fetch(`/v1/payments/${paymentId}`, {
      headers: { Accept: "application/json" },
    });
    if (response.status === 404) return null;
    if (!response.ok) return null;
    return (await response.json()) as TransferResult;
  } catch {
    return null;
  }
}

export function mapApiError(error: unknown): ApiErrorKind {
  const message = error instanceof Error ? error.message : "";
  if (message === "quoteNetworkError") return "quoteNetworkError";
  if (message === "sendError") return "sendError";
  return "quoteError";
}
