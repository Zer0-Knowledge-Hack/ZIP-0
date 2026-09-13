import {
  CreatePaymentParams,
  PaymentQuoteParams,
  PaymentQuoteResult,
  PaymentRecord,
  WebhookSubscribeParams,
  WebhookSubscribeResult,
  Zip0ClientConfig,
} from "./types.js";

export class Zip0Error extends Error {
  public status?: number;
  public details?: unknown;

  constructor(message: string, status?: number, details?: unknown) {
    super(message);
    this.name = "Zip0Error";
    this.status = status;
    this.details = details;
  }
}

export class Zip0Client {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly customFetch: typeof fetch;

  public readonly payments: {
    quote: (params: PaymentQuoteParams) => Promise<PaymentQuoteResult>;
    create: (params: CreatePaymentParams) => Promise<PaymentRecord>;
    get: (paymentId: string) => Promise<PaymentRecord>;
  };

  public readonly webhooks: {
    subscribe: (params: WebhookSubscribeParams) => Promise<WebhookSubscribeResult>;
  };

  constructor(config: Zip0ClientConfig = {}) {
    this.baseUrl = (config.baseUrl ?? "http://localhost:3000").replace(/\/$/, "");
    this.apiKey = config.apiKey;
    this.customFetch = config.fetch ?? fetch.bind(globalThis);

    this.payments = {
      quote: (params) => this.quotePayment(params),
      create: (params) => this.createPayment(params),
      get: (paymentId) => this.getPayment(paymentId),
    };

    this.webhooks = {
      subscribe: (params) => this.subscribeWebhook(params),
    };
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (this.apiKey) {
      headers["X-API-Key"] = this.apiKey;
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    const response = await this.customFetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorBody: unknown;
      try {
        errorBody = await response.json();
      } catch {
        errorBody = await response.text();
      }
      const message =
        typeof errorBody === "object" && errorBody !== null && "error" in errorBody
          ? String((errorBody as { error: unknown }).error)
          : `HTTP ${response.status}: ${response.statusText}`;

      throw new Zip0Error(message, response.status, errorBody);
    }

    return (await response.json()) as T;
  }

  private async quotePayment(params: PaymentQuoteParams): Promise<PaymentQuoteResult> {
    return this.request<PaymentQuoteResult>("/v1/payments/quote", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  private async createPayment(params: CreatePaymentParams): Promise<PaymentRecord> {
    return this.request<PaymentRecord>("/v1/payments/transfer", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  private async getPayment(paymentId: string): Promise<PaymentRecord> {
    return this.request<PaymentRecord>(`/v1/payments/${encodeURIComponent(paymentId)}`, {
      method: "GET",
    });
  }

  private async subscribeWebhook(
    params: WebhookSubscribeParams
  ): Promise<WebhookSubscribeResult> {
    return this.request<WebhookSubscribeResult>("/v1/webhooks", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }
}
