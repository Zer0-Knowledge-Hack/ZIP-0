import { describe, it, expect, vi } from "vitest";
import { PollarStellarAdapter } from "../src/adapters/pollar/client.js";
import { RelayerOrchestrator } from "../src/relayer/orchestrator.js";
import { IEvmAdapter, IStellarAdapter } from "../src/core/interfaces.js";
import { BridgePaymentStatus, CrossChainDomain, PaymentIntent } from "../src/core/types.js";
import { Keypair } from "@stellar/stellar-sdk";

describe("CCTP Bridge Core & Adapters", () => {
  describe("Stellar Address Encoding/Decoding", () => {
    it("should accurately encode and decode Stellar public keys to/from bytes32", () => {
      const keypair = Keypair.random();
      const originalStellarAddress = keypair.publicKey();

      const bytes32Hex = PollarStellarAdapter.stellarAddressToBytes32(originalStellarAddress);
      expect(bytes32Hex).toMatch(/^0x[a-fA-F0-9]{64}$/);

      const decodedAddress = PollarStellarAdapter.bytes32ToStellarAddress(bytes32Hex);
      expect(decodedAddress).toBe(originalStellarAddress);
    });
  });

  describe("RelayerOrchestrator", () => {
    it("should coordinate HSK -> Stellar payment flow", async () => {
      const mockEvm: IEvmAdapter = {
        depositPayment: vi.fn(),
        releasePayment: vi.fn(),
        getVaultBalance: vi.fn().mockResolvedValue(1000n * 1_000_000n),
        onPaymentInitiated: vi.fn(),
      };

      const mockStellar: IStellarAdapter = {
        creditPayment: vi.fn().mockResolvedValue("mock-stellar-tx-hash-123"),
        onPaymentReceived: vi.fn(),
        getBalance: vi.fn().mockResolvedValue(500n * 1_000_000n),
      };

      const orchestrator = new RelayerOrchestrator(mockEvm, mockStellar);

      const intent: PaymentIntent = {
        paymentId: "0x1111111111111111111111111111111111111111111111111111111111111111",
        amount: 50n * 1_000_000n,
        sourceDomain: CrossChainDomain.HASHKEY_CHAIN,
        destinationDomain: CrossChainDomain.STELLAR,
        sourcePayer: "0x1234567890123456789012345678901234567890",
        destinationRecipient: Keypair.random().publicKey(),
        status: BridgePaymentStatus.PROCESSING,
        createdAt: new Date(),
      };

      await orchestrator.handleHskToStellar(intent);

      expect(mockStellar.creditPayment).toHaveBeenCalledWith(
        intent.destinationRecipient,
        intent.amount,
        intent.paymentId
      );

      const status = await orchestrator.getPaymentStatus(intent.paymentId);
      expect(status?.status).toBe(BridgePaymentStatus.COMPLETED);
      expect(status?.destinationTxHash).toBe("mock-stellar-tx-hash-123");
    });

    it("should coordinate Stellar -> HSK release flow with gas sponsorship", async () => {
      const mockEvm: IEvmAdapter = {
        depositPayment: vi.fn(),
        releasePayment: vi.fn().mockResolvedValue("0xhskreleasetxhash" as `0x${string}`),
        getVaultBalance: vi.fn().mockResolvedValue(1000n * 1_000_000n),
        onPaymentInitiated: vi.fn(),
      };

      const mockStellar: IStellarAdapter = {
        creditPayment: vi.fn(),
        onPaymentReceived: vi.fn(),
        getBalance: vi.fn(),
      };

      const orchestrator = new RelayerOrchestrator(mockEvm, mockStellar);

      const txHash = await orchestrator.handleStellarToHsk({
        referenceId: "0x2222222222222222222222222222222222222222222222222222222222222222",
        amount: 25n * 1_000_000n,
        destinationHskAddress: "0x3333333333333333333333333333333333333333",
      });

      expect(txHash).toBe("0xhskreleasetxhash");
      expect(mockEvm.releasePayment).toHaveBeenCalledWith(
        "0x2222222222222222222222222222222222222222222222222222222222222222",
        "0x3333333333333333333333333333333333333333",
        25n * 1_000_000n
      );
    });

    it("should fail gracefully if HSK vault lacks liquidity", async () => {
      const mockEvm: IEvmAdapter = {
        depositPayment: vi.fn(),
        releasePayment: vi.fn(),
        getVaultBalance: vi.fn().mockResolvedValue(5n * 1_000_000n), // Only 5 USDC available
        onPaymentInitiated: vi.fn(),
      };

      const mockStellar: IStellarAdapter = {
        creditPayment: vi.fn(),
        onPaymentReceived: vi.fn(),
        getBalance: vi.fn(),
      };

      const orchestrator = new RelayerOrchestrator(mockEvm, mockStellar);

      await expect(
        orchestrator.handleStellarToHsk({
          referenceId: "0x3333333333333333333333333333333333333333333333333333333333333333",
          amount: 50n * 1_000_000n, // Attempting 50 USDC
          destinationHskAddress: "0x4444444444444444444444444444444444444444",
        })
      ).rejects.toThrow("Insufficient liquidity in HSK Vault");
    });
  });
});
