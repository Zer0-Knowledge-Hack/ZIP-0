import { describe, it, expect } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { ErrorCode } from "../src/core/errors.js";
import {
  PaymentRoutingEngine,
  CctpSettlementRail,
  VaultSettlementRail,
  Erc3009Authorizer,
  getUsdcDomain,
  ERC3009_TYPES,
  Zip0Client,
  BridgePaymentStatus,
  IEvmAdapter,
} from "../src/index.js";

describe("Institutional Payment Infrastructure & Dual-Rail Routing (Vitest)", () => {
  const mockVault: IEvmAdapter = {
    depositPayment: async () => "0xmockdeposittx" as `0x${string}`,
    releasePayment: async (_id, _rec, _amt) => "0xmockreleasetx" as `0x${string}`,
    getVaultBalance: async () => 1_000_000n * 1_000_000n, // $1,000,000 USDC in vault
    onPaymentInitiated: () => () => {},
  };

  it("should route institutional corridor (Polygon <-> Avalanche) to native CCTP rail", async () => {
    const cctpRail = new CctpSettlementRail();
    const vaultRail = new VaultSettlementRail(mockVault);
    const router = new PaymentRoutingEngine([cctpRail, vaultRail]);

    // Corridor: Polygon (137) -> Avalanche Fuji (43113)
    const quote = await router.getQuote(137, 43113, 5_000_000n * 1_000_000n); // $5M USDC
    expect(quote.railType).toBe("CCTP_BURN_MINT");
    expect(quote.estimatedFee).toBe(0n); // 0 slippage, 0 protocol fee

    // Routing and quoting are implemented. A rail constructed without a bridge client must
    // refuse rather than report a settlement that never happened.
    const paymentId =
      "0x1111111111111111111111111111111111111111111111111111111111111111" as const;

    await expect(
      router.routePayment({
        paymentId,
        amount: 5_000_000n * 1_000_000n,
        sourceDomain: 7, // Polygon
        destinationDomain: 1, // Avalanche
        sourceChainId: 137,
        destinationChainId: 43113,
        sourcePayer: "0x1234567890123456789012345678901234567890",
        destinationRecipient: "0x0987654321098765432109876543210987654321",
      })
    ).rejects.toMatchObject({ code: ErrorCode.CCTP_NOT_CONFIGURED });

    const stored = await router.getPaymentStatus(paymentId);
    expect(stored?.status).toBe(BridgePaymentStatus.FAILED);
    expect(stored?.railType).toBe("CCTP_BURN_MINT");
    expect(stored?.destinationTxHash).toBeUndefined();
  });

  it("should fallback to Vault rail when corridor includes non-CCTP chain (HSK)", async () => {
    const cctpRail = new CctpSettlementRail();
    const vaultRail = new VaultSettlementRail(mockVault);
    const router = new PaymentRoutingEngine([cctpRail, vaultRail]);

    // Corridor: HSK (133) -> Avalanche Fuji (43113)
    const quote = await router.getQuote(133, 43113, 100_000n * 1_000_000n);
    expect(quote.railType).toBe("LIQUIDITY_VAULT");
    expect(quote.estimatedFee).toBe((100_000n * 1_000_000n * 10n) / 10000n); // 10 bps

    const intent = await router.routePayment({
      paymentId: "0x2222222222222222222222222222222222222222222222222222222222222222",
      amount: 100_000n * 1_000_000n,
      sourceDomain: 10133,
      destinationDomain: 1,
      sourceChainId: 133,
      destinationChainId: 43113,
      sourcePayer: "0x1234567890123456789012345678901234567890",
      destinationRecipient: "0x0987654321098765432109876543210987654321",
    });

    expect(intent.status).toBe(BridgePaymentStatus.COMPLETED);
    expect(intent.railType).toBe("LIQUIDITY_VAULT");
    expect(intent.destinationTxHash).toBe("0xmockreleasetx");
  });

  it("should verify ERC-3009 gasless EIP-712 authorization signature", async () => {
    const authorizer = new Erc3009Authorizer();
    // Test private key (Hardhat #0)
    const privateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
    const account = privateKeyToAccount(privateKey);

    const chainId = 137; // Polygon
    const usdcAddress = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359" as `0x${string}`;
    const to = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as `0x${string}`;
    const value = 1000n * 1_000_000n;
    const now = Math.floor(Date.now() / 1000);
    const validAfter = now - 60;
    const validBefore = now + 3600;
    const nonce = authorizer.generateNonce();

    // Sign typed data with EIP-712
    const signature = await account.signTypedData({
      domain: getUsdcDomain(chainId, usdcAddress),
      types: ERC3009_TYPES,
      primaryType: "TransferWithAuthorization",
      message: {
        from: account.address,
        to,
        value,
        validAfter: BigInt(validAfter),
        validBefore: BigInt(validBefore),
        nonce,
      },
    });

    // Parse r, s, v
    const cleanSig = signature.replace("0x", "");
    const r = `0x${cleanSig.slice(0, 64)}` as `0x${string}`;
    const s = `0x${cleanSig.slice(64, 128)}` as `0x${string}`;
    const v = parseInt(cleanSig.slice(128, 130), 16);

    const payload = {
      from: account.address,
      to,
      value,
      validAfter,
      validBefore,
      nonce,
      v,
      r,
      s,
    };

    const isValid = await authorizer.verifyAuthorization(payload, chainId, usdcAddress);
    expect(isValid).toBe(true);

    // Anti-replay test
    authorizer.markNonceConsumed(payload.from, payload.nonce);
    await expect(authorizer.verifyAuthorization(payload, chainId, usdcAddress)).rejects.toThrow(
      /already consumed/
    );
  });

  it("should enable institutional payments seamlessly via Zip0Client SDK", async () => {
    const client = new Zip0Client();

    // 1. Quote
    const quote = await client.payments.quote({
      sourceChainId: 137, // Polygon
      destinationChainId: 43113, // Avalanche
      amount: "1000000.00", // 1M USDC
    });

    expect(quote.railType).toBe("CCTP_BURN_MINT");
    expect(quote.estimatedFee).toBe(0n);

    // 2. Transfer — quoting works end to end through the SDK, but a CCTP corridor with no
    //    bridge client must surface that refusal rather than a fake success.
    await expect(
      client.payments.create({
        sourceChainId: 137,
        destinationChainId: 43113,
        sourcePayer: "0x1111111111111111111111111111111111111111",
        destinationRecipient: "0x2222222222222222222222222222222222222222",
        amount: "1000000.00",
        metadata: { invoice: "INV-SINGAPORE-2026-001" },
      })
    ).rejects.toMatchObject({ code: ErrorCode.CCTP_NOT_CONFIGURED });
  });

  describe("VaultSettlementRail recipient validation", () => {
    it("should reject non-EVM Stellar recipient (starts with G) with INVALID_RECIPIENT error", async () => {
      const vaultRail = new VaultSettlementRail(mockVault);
      const stellarRecipient = "GDS232ENS4F7DZHDN6OYNECGX2ZXZ4JAWMXFPQDUH5P4DR6NRBR4J2VS";

      await expect(
        vaultRail.executeSettlement({
          paymentId: "0x1234567890123456789012345678901234567890123456789012345678901234",
          amount: 100n * 1_000_000n,
          sourceDomain: 133,
          destinationDomain: 43113,
          sourceChainId: 133,
          destinationChainId: 43113,
          sourcePayer: "0x1234567890123456789012345678901234567890",
          destinationRecipient: stellarRecipient,
        })
      ).rejects.toMatchObject({ code: ErrorCode.INVALID_RECIPIENT });
    });

    it("should reject malformed or truncated recipient addresses", async () => {
      const vaultRail = new VaultSettlementRail(mockVault);

      await expect(
        vaultRail.executeSettlement({
          paymentId: "0x1234567890123456789012345678901234567890123456789012345678901234",
          amount: 100n * 1_000_000n,
          sourceDomain: 133,
          destinationDomain: 43113,
          sourceChainId: 133,
          destinationChainId: 43113,
          sourcePayer: "0x1234567890123456789012345678901234567890",
          destinationRecipient: "0x1234",
        })
      ).rejects.toMatchObject({ code: ErrorCode.INVALID_RECIPIENT });
    });

    it("should successfully release for valid 20-byte EVM address", async () => {
      const vaultRail = new VaultSettlementRail(mockVault);
      const validEvmRecipient = "0x0987654321098765432109876543210987654321";

      const txHash = await vaultRail.executeSettlement({
        paymentId: "0x1234567890123456789012345678901234567890123456789012345678901234",
        amount: 100n * 1_000_000n,
        sourceDomain: 133,
        destinationDomain: 43113,
        sourceChainId: 133,
        destinationChainId: 43113,
        sourcePayer: "0x1234567890123456789012345678901234567890",
        destinationRecipient: validEvmRecipient,
      });

      expect(txHash).toBe("0xmockreleasetx");
    });
  });
});
