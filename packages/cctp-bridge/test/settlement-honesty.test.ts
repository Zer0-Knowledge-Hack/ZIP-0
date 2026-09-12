import { describe, it, expect, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { CctpSettlementRail } from "../src/adapters/cctp/cctpRail.js";
import { VaultSettlementRail } from "../src/adapters/vault/vaultRail.js";
import { Erc3009Relayer } from "../src/relayer/erc3009Relayer.js";
import { PollarPolygonAdapter } from "../src/adapters/pollar/polygonClient.js";
import { IEvmAdapter } from "../src/core/interfaces.js";
import { BridgePaymentStatus, PaymentIntent } from "../src/core/types.js";
import { ErrorCode } from "../src/core/errors.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function intent(overrides: Partial<PaymentIntent> = {}): PaymentIntent {
  return {
    paymentId: "0xcccc000000000000000000000000000000000000000000000000000000000001",
    amount: 100n * 1_000_000n,
    sourceChainId: 43113,
    destinationChainId: 8453,
    sourceDomain: 43113,
    destinationDomain: 8453,
    sourcePayer: "0x1234567890123456789012345678901234567890",
    destinationRecipient: "0x3333333333333333333333333333333333333333",
    status: BridgePaymentStatus.PROCESSING,
    createdAt: new Date(),
    ...overrides,
  } as PaymentIntent;
}

/**
 * A settlement path must never return a transaction hash it did not obtain from a real
 * broadcast. Returning a synthetic hash reports success for a transaction that never existed.
 */
describe("settlement honesty", () => {
  describe("CctpSettlementRail", () => {
    it("refuses to settle instead of returning a fabricated hash", async () => {
      const rail = new CctpSettlementRail();

      await expect(rail.executeSettlement(intent())).rejects.toMatchObject({
        code: ErrorCode.NOT_IMPLEMENTED,
      });
    });

    it("still reports the corridors it would serve once implemented", () => {
      const rail = new CctpSettlementRail();

      expect(rail.supportsRoute(43113, 8453)).toBe(true);
      expect(rail.supportsRoute(133, 8453)).toBe(false);
    });
  });

  describe("Erc3009Relayer", () => {
    it("verifies the authorization but refuses to claim a broadcast", async () => {
      const authorizer = {
        verifyAuthorization: vi.fn().mockResolvedValue(true),
        markNonceConsumed: vi.fn(),
      };

      const relayer = new Erc3009Relayer(
        { chainId: 43113, usdcAddress: "0x5425890298aed601595a70ab815c96711a31bc65" },
        authorizer as never
      );

      const payload = {
        from: "0x1234567890123456789012345678901234567890",
        to: "0x3333333333333333333333333333333333333333",
        value: 1_000_000n,
        validAfter: 0,
        validBefore: 9_999_999_999,
        nonce: "0xabcd000000000000000000000000000000000000000000000000000000000001",
        v: 27,
        r: "0x11",
        s: "0x22",
      };

      await expect(relayer.relayAuthorization(payload as never)).rejects.toMatchObject({
        code: ErrorCode.NOT_IMPLEMENTED,
      });

      // The valuable part must still run: signature verification is real work.
      expect(authorizer.verifyAuthorization).toHaveBeenCalledOnce();
    });
  });

  describe("PollarPolygonAdapter", () => {
    it("refuses to claim a sponsored transfer it never broadcast", async () => {
      const client = new PollarPolygonAdapter({ appId: "test-app" } as never);

      await expect(
        client.executeSponsoredTransfer(
          "0x1234567890123456789012345678901234567890",
          "0x3333333333333333333333333333333333333333",
          1_000_000n,
          "0xabcd000000000000000000000000000000000000000000000000000000000001"
        )
      ).rejects.toMatchObject({ code: ErrorCode.NOT_IMPLEMENTED });
    });
  });

  /**
   * Guard against the pattern returning. Three separate sites shipped a synthetic hash before
   * this test existed; a grep-level assertion is the cheapest way to keep it from recurring.
   */
  it("contains no synthetic transaction-hash construction in src/", () => {
    const srcDir = path.resolve(__dirname, "../src");
    const offenders: string[] = [];

    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.name.endsWith(".ts")) {
          const content = fs.readFileSync(full, "utf-8");
          content.split(/\r?\n/).forEach((line, i) => {
            // A template literal starting a 0x hash and padded to 66 chars is a fabricated hash.
            if (/`0x[a-z]+\$\{/.test(line) || /padEnd\(\s*66/.test(line)) {
              offenders.push(`${path.relative(srcDir, full)}:${i + 1}: ${line.trim()}`);
            }
          });
        }
      }
    };

    walk(srcDir);

    expect(offenders, `Synthetic transaction hashes found:\n${offenders.join("\n")}`).toEqual([]);
  });
});

/**
 * A vault release sends real funds. A recipient that is not a valid EVM address must be
 * rejected, never reshaped into one that happens to parse.
 */
describe("VaultSettlementRail recipient validation", () => {
  const adapter = (): IEvmAdapter => ({
    depositPayment: vi.fn(),
    releasePayment: vi.fn().mockResolvedValue("0xrealreleasehash" as `0x${string}`),
    getVaultBalance: vi.fn().mockResolvedValue(1_000n * 1_000_000n),
    onPaymentInitiated: vi.fn(),
  });

  it("releases to a valid EVM address", async () => {
    const evm = adapter();
    const rail = new VaultSettlementRail(evm);

    const hash = await rail.executeSettlement(
      intent({ destinationRecipient: "0x3333333333333333333333333333333333333333" })
    );

    expect(hash).toBe("0xrealreleasehash");
    expect(evm.releasePayment).toHaveBeenCalledOnce();
  });

  it("rejects a Stellar address instead of truncating it into a dead EVM address", async () => {
    const evm = adapter();
    const rail = new VaultSettlementRail(evm);

    await expect(
      rail.executeSettlement({
        ...intent({ destinationRecipient: "GDS232ENS4F7DZHDN6OYNECGX2ZXZ4JAWMXFPQDUH5P4DR6NRBR4J2VS" }),
      })
    ).rejects.toMatchObject({ code: ErrorCode.INVALID_RECIPIENT });

    expect(evm.releasePayment).not.toHaveBeenCalled();
  });

  it("rejects a hex string that is not 20 bytes", async () => {
    const evm = adapter();
    const rail = new VaultSettlementRail(evm);

    await expect(
      rail.executeSettlement(intent({ destinationRecipient: "0xdeadbeef" }))
    ).rejects.toMatchObject({ code: ErrorCode.INVALID_RECIPIENT });

    expect(evm.releasePayment).not.toHaveBeenCalled();
  });

  it("rejects an empty recipient", async () => {
    const evm = adapter();
    const rail = new VaultSettlementRail(evm);

    await expect(
      rail.executeSettlement(intent({ destinationRecipient: "" }))
    ).rejects.toMatchObject({ code: ErrorCode.INVALID_RECIPIENT });

    expect(evm.releasePayment).not.toHaveBeenCalled();
  });
});
