import { describe, it, expect, vi } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";
import { VaultSettlementRail } from "../src/rails/vault-settlement-rail.js";
import { IEvmAdapter, IStellarAdapter } from "../src/core/interfaces.js";
import { BridgePaymentStatus, CrossChainDomain, PaymentIntent } from "../src/core/types.js";
import { PollarStellarAdapter } from "../src/adapters/pollar/client.js";

function evmAdapter(overrides: Partial<IEvmAdapter> = {}): IEvmAdapter {
  return {
    depositPayment: vi.fn(),
    releasePayment: vi.fn().mockResolvedValue("0xreleasehash" as `0x${string}`),
    getVaultBalance: vi.fn().mockResolvedValue(1_000n * 1_000_000n),
    onPaymentInitiated: vi.fn(),
    ...overrides,
  };
}

function stellarAdapter(overrides: Partial<IStellarAdapter> = {}): IStellarAdapter {
  return {
    creditPayment: vi.fn().mockResolvedValue("stellar-tx-hash"),
    onPaymentReceived: vi.fn(),
    getBalance: vi.fn().mockResolvedValue(500n * 1_000_000n),
    ...overrides,
  };
}

function intent(overrides: Partial<PaymentIntent> = {}): PaymentIntent {
  return {
    paymentId: "0xbbbb000000000000000000000000000000000000000000000000000000000001",
    amount: 50n * 1_000_000n,
    sourceDomain: CrossChainDomain.HASHKEY_CHAIN,
    destinationDomain: CrossChainDomain.STELLAR,
    sourcePayer: "0x1234567890123456789012345678901234567890",
    destinationRecipient: Keypair.random().publicKey(),
    status: BridgePaymentStatus.PROCESSING,
    createdAt: new Date(),
    ...overrides,
  };
}

describe("VaultSettlementRail", () => {
  it("identifies itself as the liquidity vault rail", () => {
    const rail = new VaultSettlementRail(evmAdapter(), stellarAdapter());
    expect(rail.railType).toBe("LIQUIDITY_VAULT");
  });

  describe("supportsRoute", () => {
    const rail = new VaultSettlementRail(evmAdapter(), stellarAdapter());

    it("supports EVM to Stellar", () => {
      expect(
        rail.supportsRoute(CrossChainDomain.HASHKEY_CHAIN, CrossChainDomain.STELLAR)
      ).toBe(true);
      expect(rail.supportsRoute(CrossChainDomain.AVALANCHE, CrossChainDomain.STELLAR)).toBe(
        true
      );
    });

    it("supports Stellar to EVM", () => {
      expect(
        rail.supportsRoute(CrossChainDomain.STELLAR, CrossChainDomain.HASHKEY_CHAIN)
      ).toBe(true);
    });

    it("rejects routes it cannot serve", () => {
      expect(rail.supportsRoute(CrossChainDomain.STELLAR, CrossChainDomain.STELLAR)).toBe(false);
      expect(
        rail.supportsRoute(CrossChainDomain.AVALANCHE, CrossChainDomain.HASHKEY_CHAIN)
      ).toBe(false);
    });
  });

  describe("EVM to Stellar", () => {
    it("credits the Stellar recipient and returns the Stellar tx hash", async () => {
      const stellar = stellarAdapter();
      const rail = new VaultSettlementRail(evmAdapter(), stellar);
      const payment = intent();

      const hash = await rail.executeSettlement(payment);

      expect(hash).toBe("stellar-tx-hash");
      expect(stellar.creditPayment).toHaveBeenCalledWith(
        payment.destinationRecipient,
        payment.amount,
        payment.paymentId
      );
    });

    it("decodes a bytes32-encoded Stellar address before crediting", async () => {
      const stellar = stellarAdapter();
      const rail = new VaultSettlementRail(evmAdapter(), stellar);

      const address = Keypair.random().publicKey();
      const encoded = PollarStellarAdapter.stellarAddressToBytes32(address);

      await rail.executeSettlement(intent({ destinationRecipient: encoded }));

      expect(stellar.creditPayment).toHaveBeenCalledWith(
        address,
        expect.anything(),
        expect.anything()
      );
    });
  });

  describe("Stellar to EVM", () => {
    const inbound = () =>
      intent({
        sourceDomain: CrossChainDomain.STELLAR,
        destinationDomain: CrossChainDomain.HASHKEY_CHAIN,
        destinationRecipient: "0x3333333333333333333333333333333333333333",
      });

    it("releases vault funds to the EVM recipient", async () => {
      const evm = evmAdapter();
      const rail = new VaultSettlementRail(evm, stellarAdapter());
      const payment = inbound();

      const hash = await rail.executeSettlement(payment);

      expect(hash).toBe("0xreleasehash");
      expect(evm.releasePayment).toHaveBeenCalledWith(
        payment.paymentId,
        payment.destinationRecipient,
        payment.amount
      );
    });

    it("refuses to release more than the vault holds", async () => {
      const evm = evmAdapter({
        getVaultBalance: vi.fn().mockResolvedValue(5n * 1_000_000n),
      });
      const rail = new VaultSettlementRail(evm, stellarAdapter());

      await expect(rail.executeSettlement(inbound())).rejects.toThrow(
        /Insufficient liquidity/i
      );
      expect(evm.releasePayment).not.toHaveBeenCalled();
    });
  });

  it("rejects a route it does not serve", async () => {
    const rail = new VaultSettlementRail(evmAdapter(), stellarAdapter());

    await expect(
      rail.executeSettlement(
        intent({
          sourceDomain: CrossChainDomain.AVALANCHE,
          destinationDomain: CrossChainDomain.HASHKEY_CHAIN,
        })
      )
    ).rejects.toThrow(/route/i);
  });

  it("reports a zero fee, since vault settlement charges no bridge fee today", async () => {
    const rail = new VaultSettlementRail(evmAdapter(), stellarAdapter());

    const fee = await rail.estimateFee(
      CrossChainDomain.HASHKEY_CHAIN,
      CrossChainDomain.STELLAR,
      100n * 1_000_000n
    );

    expect(fee).toBe(0n);
  });
});
