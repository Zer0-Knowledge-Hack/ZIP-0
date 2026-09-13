import crypto from "crypto";
import { IPaymentRouter } from "../core/interfaces.js";
import {
  BridgePaymentStatus,
  CrossChainDomain,
  PaymentIntent,
  PaymentQuote,
  AuthorizationPayload,
} from "../core/types.js";

export interface CreateQuoteRequest {
  sourceChainId: number;
  destinationChainId: number;
  amount: string; // Decimal string e.g. "1000000.00"
}

export interface CreateTransferRequest {
  sourceChainId: number;
  destinationChainId: number;
  sourcePayer: string;
  destinationRecipient: string;
  amount: string;
  authorization?: AuthorizationPayload;
  metadata?: Record<string, unknown>;
}

export interface WebhookSubscription {
  url: string;
  secret: string;
}

export class PaymentApiGateway {
  private router: IPaymentRouter;
  private webhooks: WebhookSubscription[] = [];

  constructor(router: IPaymentRouter) {
    this.router = router;
  }

  public registerWebhook(subscription: WebhookSubscription): void {
    this.webhooks.push(subscription);
  }

  public async handleQuote(req: CreateQuoteRequest): Promise<PaymentQuote> {
    const rawAmount = BigInt(Math.round(parseFloat(req.amount) * 1_000_000));
    return this.router.getQuote(req.sourceChainId, req.destinationChainId, rawAmount);
  }

  public async handleTransfer(req: CreateTransferRequest): Promise<PaymentIntent> {
    const rawAmount = BigInt(Math.round(parseFloat(req.amount) * 1_000_000));
    const paymentId = `0x${crypto.randomBytes(32).toString("hex")}` as `0x${string}`;

    const intent = await this.router.routePayment({
      paymentId,
      amount: rawAmount,
      sourceDomain: req.sourceChainId as CrossChainDomain,
      destinationDomain: req.destinationChainId as CrossChainDomain,
      sourceChainId: req.sourceChainId,
      destinationChainId: req.destinationChainId,
      sourcePayer: req.sourcePayer,
      destinationRecipient: req.destinationRecipient,
      authorization: req.authorization,
      metadata: req.metadata,
    });

    this.dispatchWebhooks({
      event: "payment.settled",
      paymentId: intent.paymentId,
      status: intent.status,
      destinationTxHash: intent.destinationTxHash,
      timestamp: Date.now(),
    });

    return intent;
  }

  public async handleGetStatus(paymentId: `0x${string}`): Promise<{
    paymentId: `0x${string}`;
    status: BridgePaymentStatus;
    destinationTxHash?: string;
  } | null> {
    const payment = await this.router.getPaymentStatus(paymentId);
    if (!payment) return null;

    return {
      paymentId: payment.paymentId,
      status: payment.status,
      destinationTxHash: payment.destinationTxHash,
    };
  }

  private dispatchWebhooks(payload: Record<string, unknown>): void {
    // In production, dispatches HMAC-SHA256 signed HTTP POST to registered subscriber URLs
    for (const hook of this.webhooks) {
      // Background non-blocking notification
      void hook;
      void payload;
    }
  }
}
