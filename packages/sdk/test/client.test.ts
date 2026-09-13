import { describe, expect, it, vi } from "vitest";
import { Zip0Client, Zip0Error } from "../src/index.js";

describe("Zip0Client", () => {
  it("sends quote request with correct URL and headers", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        sourceChain: "avalanche",
        destinationChain: "hashkey",
        sourceChainId: 43113,
        destinationChainId: 133,
        amount: "100.00",
        estimatedFee: "0.00",
        railType: "VAULT_RELAYER",
        estimatedFinalitySeconds: 5,
      }),
    });

    const client = new Zip0Client({
      apiKey: "test-api-key",
      baseUrl: "https://api.test.zip0.io",
      fetch: mockFetch as unknown as typeof fetch,
    });

    const quote = await client.payments.quote({
      sourceChain: "avalanche",
      destinationChain: "hashkey",
      amount: "100.00",
    });

    expect(mockFetch).toHaveBeenCalledWith("https://api.test.zip0.io/v1/payments/quote", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-API-Key": "test-api-key",
        Authorization: "Bearer test-api-key",
      },
      body: JSON.stringify({
        sourceChain: "avalanche",
        destinationChain: "hashkey",
        amount: "100.00",
      }),
    });

    expect(quote.railType).toBe("VAULT_RELAYER");
    expect(quote.estimatedFinalitySeconds).toBe(5);
  });

  it("creates payment transfer with payload", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        paymentId: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        status: "PROCESSING",
        destinationRecipient: "0xRecipient",
        railType: "VAULT_RELAYER",
      }),
    });

    const client = new Zip0Client({
      fetch: mockFetch as unknown as typeof fetch,
    });

    const payment = await client.payments.create({
      amount: "5000000.00",
      sourceChain: "avalanche",
      destinationChain: "hashkey",
      recipient: "0xRecipient",
      reference: "INV-2026-SG-001",
    });

    expect(payment.status).toBe("PROCESSING");
    expect(payment.paymentId).toBe("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef");
  });

  it("fetches payment status by ID", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        paymentId: "0xabc",
        status: "COMPLETED",
        destinationTxHash: "0xdeadbeef",
      }),
    });

    const client = new Zip0Client({
      fetch: mockFetch as unknown as typeof fetch,
    });

    const payment = await client.payments.get("0xabc");
    expect(payment.status).toBe("COMPLETED");
    expect(payment.destinationTxHash).toBe("0xdeadbeef");
  });

  it("subscribes to webhooks", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "hook-1",
        url: "https://example.com/webhook",
        status: "active",
      }),
    });

    const client = new Zip0Client({
      fetch: mockFetch as unknown as typeof fetch,
    });

    const sub = await client.webhooks.subscribe({
      url: "https://example.com/webhook",
      secret: "whsec_xyz",
    });

    expect(sub.id).toBe("hook-1");
    expect(sub.status).toBe("active");
  });

  it("throws Zip0Error on failure response", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
      json: async () => ({ error: "Payment not found" }),
    });

    const client = new Zip0Client({
      fetch: mockFetch as unknown as typeof fetch,
    });

    await expect(client.payments.get("0xnotfound")).rejects.toThrow(Zip0Error);
  });
});
