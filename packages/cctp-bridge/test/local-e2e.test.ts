import { describe, it, expect } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";
import { CrossChainDomain, BridgePaymentStatus, PaymentIntent } from "../src/core/types.js";
import { RelayerOrchestrator } from "../src/relayer/orchestrator.js";
import { IEvmAdapter, IStellarAdapter } from "../src/core/interfaces.js";
import { PollarStellarAdapter } from "../src/adapters/pollar/client.js";

describe("Local Node E2E Integration (Vitest)", () => {
  it("should process an end-to-end local payment cycle from HSK to Stellar", async () => {
    let releasedPaymentId: string | null = null;
    let releasedAmount: bigint = 0n;

    // In-memory simulation of local Hardhat node contract
    const mockLocalVault: IEvmAdapter = {
      depositPayment: async (_intent) => "0xlocaldeposittxhash" as `0x${string}`,
      releasePayment: async (paymentId, _recipient, amount) => {
        releasedPaymentId = paymentId;
        releasedAmount = amount;
        return "0xlocalreleasetxhash" as `0x${string}`;
      },
      getVaultBalance: async () => 10_000n * 1_000_000n, // 10,000 MockUSDC in local vault
      onPaymentInitiated: (_cb) => () => {},
    };

    const mockStellar: IStellarAdapter = {
      creditPayment: async (_recipient, _amount, referenceId) => `stellar-tx-${referenceId}`,
      onPaymentReceived: (_cb) => () => {},
      getBalance: async () => 5000n * 1_000_000n,
    };

    const orchestrator = new RelayerOrchestrator(mockLocalVault, mockStellar);

    // 1. User deposits in local HSK Vault
    const testPaymentId = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const testAmount = 100n * 1_000_000n; // 100 USDC
    const stellarRecipient = Keypair.random().publicKey();
    const encodedRecipient = PollarStellarAdapter.stellarAddressToBytes32(stellarRecipient);

    const intent: PaymentIntent = {
      paymentId: testPaymentId,
      amount: testAmount,
      sourceDomain: CrossChainDomain.HASHKEY_CHAIN,
      destinationDomain: CrossChainDomain.STELLAR,
      sourcePayer: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", // Hardhat Account #0
      destinationRecipient: encodedRecipient,
      status: BridgePaymentStatus.PENDING,
      createdAt: new Date(),
    };

    // 2. Relayer picks up deposit and settles in Stellar
    await orchestrator.handleHskToStellar(intent);

    const status = await orchestrator.getPaymentStatus(testPaymentId);
    expect(status?.status).toBe(BridgePaymentStatus.COMPLETED);
    expect(status?.destinationTxHash).toBe(`stellar-tx-${testPaymentId}`);

    // 3. Reverse settlement: Stellar payment releases funds on local HSK
    const reverseTxHash = await orchestrator.handleStellarToHsk({
      referenceId: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      amount: 50n * 1_000_000n,
      destinationHskAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", // Hardhat Account #1
    });

    expect(reverseTxHash).toBe("0xlocalreleasetxhash");
    expect(releasedPaymentId).toBe("0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
    expect(releasedAmount).toBe(50n * 1_000_000n);
  });
});
