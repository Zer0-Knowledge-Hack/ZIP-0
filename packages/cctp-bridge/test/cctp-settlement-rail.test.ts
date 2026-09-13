import { describe, it, expect } from "vitest";
import {
  BridgePaymentStatus,
  CctpSettlementRail,
  ErrorCode,
  PaymentIntent,
  PaymentRoutingEngine,
} from "../src/index.js";
import type {
  CctpBridgeClient,
  CctpBridgeParams,
  CctpBridgeReceipt,
} from "../src/index.js";
import { BridgeError } from "../src/core/errors.js";

const BURN_HASH = `0x${"11".repeat(32)}` as `0x${string}`;
const MINT_HASH = `0x${"22".repeat(32)}` as `0x${string}`;
const RECIPIENT = "0x3333333333333333333333333333333333333333" as const;

function intent(overrides: Partial<PaymentIntent> = {}): PaymentIntent {
  return {
    paymentId: `0x${"aa".repeat(32)}` as `0x${string}`,
    amount: 25n * 1_000_000n,
    sourceChainId: 43113, // Avalanche Fuji
    destinationChainId: 8453, // Base
    sourceDomain: 43113,
    destinationDomain: 8453,
    sourcePayer: "0x1111111111111111111111111111111111111111",
    destinationRecipient: RECIPIENT,
    status: BridgePaymentStatus.PROCESSING,
    createdAt: new Date(),
    ...overrides,
  } as PaymentIntent;
}

class FakeBridgeClient implements CctpBridgeClient {
  public calls: CctpBridgeParams[] = [];

  constructor(
    private readonly receipt: CctpBridgeReceipt = {
      sourceTxHash: BURN_HASH,
      destinationTxHash: MINT_HASH,
      steps: [],
    },
    private readonly failure?: unknown
  ) {}

  async bridge(params: CctpBridgeParams): Promise<CctpBridgeReceipt> {
    this.calls.push(params);
    if (this.failure) throw this.failure;
    return this.receipt;
  }
}

describe("CctpSettlementRail", () => {
  describe("supportsRoute", () => {
    it("serves only corridors where both chains run Circle CCTP", () => {
      const rail = new CctpSettlementRail();

      expect(rail.supportsRoute(137, 43113)).toBe(true); // Polygon -> Avalanche Fuji
      expect(rail.supportsRoute(43113, 8453)).toBe(true); // Fuji -> Base
      expect(rail.supportsRoute(133, 43113)).toBe(false); // HashKey -> Fuji
      expect(rail.supportsRoute(43113, 177)).toBe(false); // Fuji -> HashKey mainnet
      expect(rail.supportsRoute(21, 43113)).toBe(false); // Stellar -> Fuji
      expect(rail.supportsRoute(43113, 43113)).toBe(false); // same chain
    });
  });

  describe("estimateFee", () => {
    it("quotes zero protocol fee on a supported corridor", async () => {
      const rail = new CctpSettlementRail();
      await expect(rail.estimateFee(137, 43113, 1_000_000n)).resolves.toBe(0n);
    });

    it("rejects an unsupported corridor", async () => {
      const rail = new CctpSettlementRail();
      await expect(rail.estimateFee(133, 43113, 1_000_000n)).rejects.toMatchObject({
        code: ErrorCode.UNSUPPORTED_DOMAIN,
      });
    });
  });

  describe("executeSettlement", () => {
    it("returns the destination mint hash reported by the bridge client", async () => {
      const client = new FakeBridgeClient();
      const rail = new CctpSettlementRail(client, { transferSpeed: "SLOW" });

      const hash = await rail.executeSettlement(intent());

      expect(hash).toBe(MINT_HASH);
      expect(client.calls).toHaveLength(1);
      expect(client.calls[0]).toMatchObject({
        sourceChainId: 43113,
        destinationChainId: 8453,
        amount: 25n * 1_000_000n,
        recipient: RECIPIENT,
        transferSpeed: "SLOW",
      });
    });

    it("refuses to settle when no bridge client is configured", async () => {
      const rail = new CctpSettlementRail();

      await expect(rail.executeSettlement(intent())).rejects.toMatchObject({
        code: ErrorCode.CCTP_NOT_CONFIGURED,
      });
    });

    it("rejects a non-EVM recipient instead of reshaping it", async () => {
      const client = new FakeBridgeClient();
      const rail = new CctpSettlementRail(client);

      await expect(
        rail.executeSettlement(intent({ destinationRecipient: "GDS232ENS4F7DZHDN6OYNECGX2ZXZ4JAWMXFPQDUH5P4DR6NRBR4J2VS" }))
      ).rejects.toMatchObject({ code: ErrorCode.INVALID_RECIPIENT });

      expect(client.calls).toHaveLength(0);
    });

    it("rejects a non-positive amount", async () => {
      const client = new FakeBridgeClient();
      const rail = new CctpSettlementRail(client);

      await expect(rail.executeSettlement(intent({ amount: 0n }))).rejects.toMatchObject({
        code: ErrorCode.INVALID_AMOUNT,
      });

      expect(client.calls).toHaveLength(0);
    });

    it("wraps an unknown bridge failure as CCTP_SETTLEMENT_FAILED", async () => {
      const client = new FakeBridgeClient(undefined, new Error("rpc down"));
      const rail = new CctpSettlementRail(client);

      await expect(rail.executeSettlement(intent())).rejects.toMatchObject({
        code: ErrorCode.CCTP_SETTLEMENT_FAILED,
      });
    });

    it("propagates a bridge error unchanged", async () => {
      const client = new FakeBridgeClient(
        undefined,
        new BridgeError(ErrorCode.CCTP_SETTLEMENT_FAILED, "attestation timed out")
      );
      const rail = new CctpSettlementRail(client);

      await expect(rail.executeSettlement(intent())).rejects.toMatchObject({
        code: ErrorCode.CCTP_SETTLEMENT_FAILED,
        message: expect.stringContaining("attestation timed out"),
      });
    });
  });

  it("can be registered with the router without any engine change", async () => {
    const rail = new CctpSettlementRail(new FakeBridgeClient());
    const router = new PaymentRoutingEngine([rail]);

    const settled = await router.routePayment({
      paymentId: `0x${"bb".repeat(32)}` as `0x${string}`,
      amount: 25n * 1_000_000n,
      sourceChainId: 137,
      destinationChainId: 43113,
      sourceDomain: 7,
      destinationDomain: 1,
      sourcePayer: "0x1111111111111111111111111111111111111111",
      destinationRecipient: RECIPIENT,
    });

    expect(settled.railType).toBe("CCTP_BURN_MINT");
    expect(settled.status).toBe(BridgePaymentStatus.COMPLETED);
    expect(settled.destinationTxHash).toBe(MINT_HASH);
  });
});
