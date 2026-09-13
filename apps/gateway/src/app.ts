import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import crypto from "crypto";
import { IPaymentRouter } from "@zip-0/cctp-bridge/dist/core/interfaces.js";
import { CrossChainDomain } from "@zip-0/cctp-bridge/dist/core/types.js";
import { resolveChain } from "./config/chains.js";
import { createDefaultRoutingEngine } from "./services/router.js";

export interface WebhookRecord {
  id: string;
  url: string;
  secret: string;
  events?: string[];
}

export function createApp(router?: IPaymentRouter): Express {
  const app = express();
  const routingEngine = router ?? createDefaultRoutingEngine();
  const webhooks: WebhookRecord[] = [];
  const paymentMetadata = new Map<string, Record<string, unknown>>();

  app.use(cors());
  app.use(express.json());

  // Health check
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  // POST /v1/payments/quote
  app.post("/v1/payments/quote", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sourceChain, destinationChain, amount } = req.body;

      if (!sourceChain || !destinationChain || !amount) {
        return res.status(400).json({
          error: "Missing required fields: sourceChain, destinationChain, amount",
        });
      }

      const source = resolveChain(sourceChain);
      const destination = resolveChain(destinationChain);

      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ error: "Invalid amount" });
      }

      const rawAmount = BigInt(Math.round(parsedAmount * 1_000_000));
      const quote = await routingEngine.getQuote(source.chainId, destination.chainId, rawAmount);

      const feeUnits = (Number(quote.estimatedFee) / 1_000_000).toFixed(6);

      res.json({
        sourceChain: source.name,
        destinationChain: destination.name,
        sourceChainId: source.chainId,
        destinationChainId: destination.chainId,
        amount: parsedAmount.toFixed(2),
        estimatedFee: feeUnits,
        railType: quote.railType,
        estimatedFinalitySeconds: quote.estimatedFinalitySeconds,
      });
    } catch (err) {
      next(err);
    }
  });

  // POST /v1/payments/transfer
  app.post("/v1/payments/transfer", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        sourceChain,
        destinationChain,
        amount,
        recipient,
        payer,
        reference,
        authorization,
        metadata,
      } = req.body;

      if (!sourceChain || !destinationChain || !amount || !recipient) {
        return res.status(400).json({
          error: "Missing required fields: sourceChain, destinationChain, amount, recipient",
        });
      }

      const source = resolveChain(sourceChain);
      const destination = resolveChain(destinationChain);

      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ error: "Invalid amount" });
      }
      const rawAmount = BigInt(Math.round(parsedAmount * 1_000_000));

      const paymentId = `0x${crypto.randomBytes(32).toString("hex")}` as `0x${string}`;

      if (reference || metadata) {
        paymentMetadata.set(paymentId, { reference, ...(metadata || {}) });
      }

      const routed = await routingEngine.routePayment({
        paymentId,
        amount: rawAmount,
        sourceDomain: source.domain as CrossChainDomain,
        destinationDomain: destination.domain as CrossChainDomain,
        sourceChainId: source.chainId,
        destinationChainId: destination.chainId,
        sourcePayer: payer ?? "0x0000000000000000000000000000000000000000",
        destinationRecipient: recipient,
        authorization,
        metadata: { reference, ...metadata },
      });

      // Notify webhooks asynchronously
      for (const hook of webhooks) {
        void hook; // In production, dispatches HMAC signed payload
      }

      res.status(201).json({
        paymentId: routed.paymentId,
        status: routed.status,
        sourceChain: source.name,
        destinationChain: destination.name,
        amount: parsedAmount.toFixed(2),
        destinationRecipient: recipient,
        destinationTxHash: routed.destinationTxHash,
        railType: routed.railType,
        createdAt: routed.createdAt.toISOString(),
      });
    } catch (err) {
      next(err);
    }
  });

  // GET /v1/payments/:id
  app.get("/v1/payments/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const paymentId = req.params.id as `0x${string}`;
      const payment = await routingEngine.getPaymentStatus(paymentId);

      if (!payment) {
        return res.status(404).json({ error: `Payment not found: ${paymentId}` });
      }

      const meta = paymentMetadata.get(paymentId);

      res.json({
        paymentId: payment.paymentId,
        status: payment.status,
        sourceDomain: payment.sourceDomain,
        destinationDomain: payment.destinationDomain,
        amount: (Number(payment.amount) / 1_000_000).toFixed(2),
        destinationRecipient: payment.destinationRecipient,
        destinationTxHash: payment.destinationTxHash,
        railType: payment.railType,
        createdAt: payment.createdAt?.toISOString(),
        metadata: meta,
      });
    } catch (err) {
      next(err);
    }
  });

  // POST /v1/webhooks
  app.post("/v1/webhooks", (req: Request, res: Response) => {
    const { url, secret, events } = req.body;

    if (!url || !secret) {
      return res.status(400).json({ error: "Missing required fields: url, secret" });
    }

    const hookId = `hook_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const hook: WebhookRecord = {
      id: hookId,
      url,
      secret,
      events: events ?? ["payment.settled", "payment.failed"],
    };

    webhooks.push(hook);

    res.status(201).json({
      id: hook.id,
      url: hook.url,
      status: "active",
      events: hook.events,
    });
  });

  // Error handler middleware
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({ error: err.message || "Internal server error" });
  });

  return app;
}
