import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { FilePaymentStore } from "../src/core/file-payment-store.js";
import { InMemoryPaymentStore } from "../src/core/in-memory-payment-store.js";
import { IEvmAdapter, IStellarAdapter } from "../src/core/interfaces.js";
import { BridgePaymentStatus, CrossChainDomain, PaymentIntent } from "../src/core/types.js";
import { RelayerOrchestrator } from "../src/relayer/orchestrator.js";

const PAYMENT_ID = "0xdddd000000000000000000000000000000000000000000000000000000000001" as const;

function sampleIntent(overrides: Partial<PaymentIntent> = {}): PaymentIntent {
  return {
    paymentId: PAYMENT_ID,
    amount: 75n * 1_000_000n,
    sourceDomain: CrossChainDomain.HASHKEY_CHAIN,
    destinationDomain: CrossChainDomain.STELLAR,
    sourcePayer: "0x1234567890123456789012345678901234567890",
    destinationRecipient: "GDESTINATIONRECIPIENT",
    status: BridgePaymentStatus.PROCESSING,
    createdAt: new Date("2026-09-12T21:00:00.000Z"),
    ...overrides,
  };
}

describe("InMemoryPaymentStore", () => {
  it("implements get, set, list, and findByStatus", async () => {
    const store = new InMemoryPaymentStore();
    const processing = sampleIntent();
    const completed = sampleIntent({
      paymentId: "0xdddd000000000000000000000000000000000000000000000000000000000002",
      status: BridgePaymentStatus.COMPLETED,
      destinationTxHash: "stellar-tx-completed",
    });

    await store.set(processing);
    await store.set(completed);

    expect(await store.get(processing.paymentId)).toMatchObject({
      paymentId: processing.paymentId,
      amount: 75n * 1_000_000n,
      status: BridgePaymentStatus.PROCESSING,
    });
    expect(await store.get("0xdead000000000000000000000000000000000000000000000000000000000000")).toBeNull();

    const listed = await store.list();
    expect(listed).toHaveLength(2);

    const completedOnly = await store.findByStatus(BridgePaymentStatus.COMPLETED);
    expect(completedOnly).toHaveLength(1);
    expect(completedOnly[0]?.paymentId).toBe(completed.paymentId);
  });
});

describe("FilePaymentStore durability", () => {
  let tempDir: string | undefined;

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  async function storeFile(): Promise<string> {
    tempDir = await mkdtemp(path.join(tmpdir(), "zip0-payment-store-"));
    return path.join(tempDir, "payments.json");
  }

  it("recovers a payment after the store is recreated from the same file", async () => {
    const filePath = await storeFile();
    const first = new FilePaymentStore(filePath);
    const intent = sampleIntent({
      authorization: {
        from: "0x1234567890123456789012345678901234567890",
        to: "0x0987654321098765432109876543210987654321",
        value: 75n * 1_000_000n,
        validAfter: 0,
        validBefore: 1,
        nonce: "0x1111111111111111111111111111111111111111111111111111111111111111",
        v: 27,
        r: "0x2222222222222222222222222222222222222222222222222222222222222222",
        s: "0x3333333333333333333333333333333333333333333333333333333333333333",
      },
    });

    await first.set(intent);

    const second = new FilePaymentStore(filePath);
    const restored = await second.get(PAYMENT_ID);

    expect(restored).not.toBeNull();
    expect(restored?.paymentId).toBe(PAYMENT_ID);
    expect(restored?.status).toBe(BridgePaymentStatus.PROCESSING);
    expect(restored?.amount).toBe(75n * 1_000_000n);
    expect(restored?.createdAt).toBeInstanceOf(Date);
    expect(restored?.createdAt.toISOString()).toBe("2026-09-12T21:00:00.000Z");
    expect(restored?.authorization?.value).toBe(75n * 1_000_000n);
  });

  it("persists a later status update across store recreation", async () => {
    const filePath = await storeFile();
    const first = new FilePaymentStore(filePath);

    await first.set(sampleIntent({ status: BridgePaymentStatus.PENDING }));
    await first.set(
      sampleIntent({
        status: BridgePaymentStatus.COMPLETED,
        destinationTxHash: "stellar-tx-after-update",
      })
    );

    const restored = await new FilePaymentStore(filePath).get(PAYMENT_ID);

    expect(restored?.status).toBe(BridgePaymentStatus.COMPLETED);
    expect(restored?.destinationTxHash).toBe("stellar-tx-after-update");
    expect(restored?.amount).toBe(75n * 1_000_000n);
  });

  it("finds persisted payments by status after recreation", async () => {
    const filePath = await storeFile();
    const first = new FilePaymentStore(filePath);

    await first.set(sampleIntent({ status: BridgePaymentStatus.FAILED }));
    await first.set(
      sampleIntent({
        paymentId: "0xdddd000000000000000000000000000000000000000000000000000000000099",
        status: BridgePaymentStatus.COMPLETED,
      })
    );

    const second = new FilePaymentStore(filePath);
    const failed = await second.findByStatus(BridgePaymentStatus.FAILED);
    const listed = await second.list();

    expect(failed).toHaveLength(1);
    expect(failed[0]?.paymentId).toBe(PAYMENT_ID);
    expect(listed).toHaveLength(2);
  });

  it("lets RelayerOrchestrator recover COMPLETED status after a new process-style store", async () => {
    const filePath = await storeFile();

    const mockEvm: IEvmAdapter = {
      depositPayment: vi.fn(),
      releasePayment: vi.fn(),
      getVaultBalance: vi.fn().mockResolvedValue(1_000n * 1_000_000n),
      onPaymentInitiated: vi.fn(),
    };
    const mockStellar: IStellarAdapter = {
      creditPayment: vi.fn().mockResolvedValue("stellar-tx-durable"),
      onPaymentReceived: vi.fn(),
      getBalance: vi.fn().mockResolvedValue(0n),
    };

    const first = new RelayerOrchestrator(
      mockEvm,
      mockStellar,
      undefined,
      new FilePaymentStore(filePath)
    );

    await first.handleHskToStellar(sampleIntent({ status: BridgePaymentStatus.PENDING }));

    const restarted = new RelayerOrchestrator(
      mockEvm,
      mockStellar,
      undefined,
      new FilePaymentStore(filePath)
    );
    const restored = await restarted.getPaymentStatus(PAYMENT_ID);

    expect(restored?.status).toBe(BridgePaymentStatus.COMPLETED);
    expect(restored?.destinationTxHash).toBe("stellar-tx-durable");
    expect(restored?.amount).toBe(75n * 1_000_000n);
  });
});
