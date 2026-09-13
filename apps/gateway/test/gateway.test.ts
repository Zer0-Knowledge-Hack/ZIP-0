import { describe, expect, it, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { Server } from "http";
import { createApp } from "../src/app.js";
import { Zip0Client } from "@zip-0/sdk";

describe("Gateway REST API Integration Tests", () => {
  const app = createApp();
  let server: Server;
  let baseUrl: string;
  let createdPaymentId: string;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        if (typeof addr === "object" && addr !== null) {
          baseUrl = `http://localhost:${addr.port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  describe("GET /health", () => {
    it("returns status ok", async () => {
      const res = await request(app).get("/health");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: "ok" });
    });
  });

  describe("POST /v1/payments/quote", () => {
    it("calculates quote between avalanche and hashkey", async () => {
      const res = await request(app)
        .post("/v1/payments/quote")
        .send({
          sourceChain: "avalanche",
          destinationChain: "hashkey",
          amount: "500.00",
        });

      expect(res.status).toBe(200);
      expect(res.body.sourceChain).toBe("avalanche");
      expect(res.body.destinationChain).toBe("hashkey");
      expect(res.body.amount).toBe("500.00");
      expect(res.body.railType).toBeDefined();
      expect(res.body.estimatedFinalitySeconds).toBeGreaterThan(0);
    });

    it("rejects request missing required fields", async () => {
      const res = await request(app)
        .post("/v1/payments/quote")
        .send({
          sourceChain: "avalanche",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Missing required fields");
    });
  });

  describe("POST /v1/payments/transfer", () => {
    it("initiates a payment transfer successfully", async () => {
      const res = await request(app)
        .post("/v1/payments/transfer")
        .send({
          amount: "1500.00",
          sourceChain: "avalanche",
          destinationChain: "hashkey",
          recipient: "0xRecipientAddress123456789012345678901234",
          reference: "INV-2026-TEST",
        });

      expect(res.status).toBe(201);
      expect(res.body.paymentId).toMatch(/^0x[a-f0-9]{64}$/i);
      expect(res.body.destinationRecipient).toBe("0xRecipientAddress123456789012345678901234");
      expect(res.body.destinationTxHash).toMatch(/^0x[a-f0-9]{64}$/i);

      createdPaymentId = res.body.paymentId;
    });

    it("rejects invalid amount", async () => {
      const res = await request(app)
        .post("/v1/payments/transfer")
        .send({
          amount: "-50.00",
          sourceChain: "avalanche",
          destinationChain: "hashkey",
          recipient: "0xRecipientAddress",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Invalid amount");
    });
  });

  describe("GET /v1/payments/:id", () => {
    it("returns status for existing payment", async () => {
      expect(createdPaymentId).toBeDefined();

      const res = await request(app).get(`/v1/payments/${createdPaymentId}`);
      expect(res.status).toBe(200);
      expect(res.body.paymentId).toBe(createdPaymentId);
      expect(res.body.destinationTxHash).toBeDefined();
    });

    it("returns 404 for unknown payment ID", async () => {
      const res = await request(app).get("/v1/payments/0x0000000000000000000000000000000000000000000000000000000000000000");
      expect(res.status).toBe(404);
      expect(res.body.error).toContain("Payment not found");
    });
  });

  describe("POST /v1/webhooks", () => {
    it("registers a webhook subscriber", async () => {
      const res = await request(app)
        .post("/v1/webhooks")
        .send({
          url: "https://fintech.example.com/webhooks/zip0",
          secret: "whsec_supersecret123",
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toMatch(/^hook_/);
      expect(res.body.url).toBe("https://fintech.example.com/webhooks/zip0");
      expect(res.body.status).toBe("active");
    });

    it("rejects webhook registration without secret", async () => {
      const res = await request(app)
        .post("/v1/webhooks")
        .send({
          url: "https://fintech.example.com/webhooks/zip0",
        });

      expect(res.status).toBe(400);
    });
  });

  describe("End-to-end with @zip-0/sdk", () => {
    it("executes quote, transfer, and status query via Zip0Client against the running gateway", async () => {
      const client = new Zip0Client({
        baseUrl,
        apiKey: "test-api-key",
      });

      // 1. Quote
      const quote = await client.payments.quote({
        sourceChain: "avalanche",
        destinationChain: "hashkey",
        amount: "2500.00",
      });
      expect(quote.sourceChain).toBe("avalanche");
      expect(quote.destinationChain).toBe("hashkey");
      expect(quote.amount).toBe("2500.00");

      // 2. Transfer
      const transfer = await client.payments.create({
        amount: "2500.00",
        sourceChain: "avalanche",
        destinationChain: "hashkey",
        recipient: "0xInstitutionalVaultDestination",
        reference: "INV-E2E-001",
      });
      expect(transfer.paymentId).toMatch(/^0x/);
      expect(transfer.destinationTxHash).toMatch(/^0x/);

      // 3. Get Status
      const status = await client.payments.get(transfer.paymentId);
      expect(status.paymentId).toBe(transfer.paymentId);
      expect(status.destinationTxHash).toBe(transfer.destinationTxHash);

      // 4. Webhook Subscription
      const webhook = await client.webhooks.subscribe({
        url: "https://client.example.com/notifications",
        secret: "whsec_client_123",
      });
      expect(webhook.status).toBe("active");
    });
  });
});
