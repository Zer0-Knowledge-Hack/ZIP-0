import { describe, it, expect, vi } from "vitest";
import { PaymentRoutingEngine } from "../src/routing/payment-routing-engine.js";
import { ISettlementRail } from "../src/core/interfaces.js";
import {
  CrossChainDomain,
  BridgePaymentStatus,
  PaymentRequest,
  SettlementRailType,
} from "../src/core/types.js";
import { UnsupportedRouteError } from "../src/core/errors.js";

/**
 * Builds a stub rail that claims support for exactly one route.
 * Used to prove the engine selects by route rather than by hardcoded branching.
 */
function stubRail(
  railType: SettlementRailType,
  supported: Array<[CrossChainDomain, CrossChainDomain]>,
  txHash = "0xstubsettlement"
): ISettlementRail {
  return {
    railType,
    supportsRoute: (source, destination) =>
      supported.some(([s, d]) => s === source && d === destination),
    estimateFee: vi.fn().mockResolvedValue(0n),
    executeSettlement: vi.fn().mockResolvedValue(txHash),
  };
}

const baseRequest: PaymentRequest = {
  paymentId: "0xaaaa000000000000000000000000000000000000000000000000000000000001",
  amount: 100n * 1_000_000n,
  sourceDomain: CrossChainDomain.HASHKEY_CHAIN,
  destinationDomain: CrossChainDomain.STELLAR,
  sourcePayer: "0x1234567890123456789012345678901234567890",
  destinationRecipient: "GSTELLARRECIPIENT",
};

describe("PaymentRoutingEngine", () => {
  it("selects the rail that supports the requested route", async () => {
    const vaultRail = stubRail("LIQUIDITY_VAULT", [
      [CrossChainDomain.HASHKEY_CHAIN, CrossChainDomain.STELLAR],
    ]);
    const cctpRail = stubRail("CCTP_BURN_MINT", [
      [CrossChainDomain.AVALANCHE, CrossChainDomain.HASHKEY_CHAIN],
    ]);

    const engine = new PaymentRoutingEngine([vaultRail, cctpRail]);
    const intent = await engine.routePayment(baseRequest);

    expect(intent.railType).toBe("LIQUIDITY_VAULT");
    expect(vaultRail.executeSettlement).toHaveBeenCalledOnce();
    expect(cctpRail.executeSettlement).not.toHaveBeenCalled();
  });

  it("selects a different rail when the route changes, with no engine changes", async () => {
    const vaultRail = stubRail("LIQUIDITY_VAULT", [
      [CrossChainDomain.HASHKEY_CHAIN, CrossChainDomain.STELLAR],
    ]);
    const cctpRail = stubRail("CCTP_BURN_MINT", [
      [CrossChainDomain.AVALANCHE, CrossChainDomain.HASHKEY_CHAIN],
    ]);

    const engine = new PaymentRoutingEngine([vaultRail, cctpRail]);
    const intent = await engine.routePayment({
      ...baseRequest,
      sourceDomain: CrossChainDomain.AVALANCHE,
      destinationDomain: CrossChainDomain.HASHKEY_CHAIN,
    });

    expect(intent.railType).toBe("CCTP_BURN_MINT");
    expect(cctpRail.executeSettlement).toHaveBeenCalledOnce();
    expect(vaultRail.executeSettlement).not.toHaveBeenCalled();
  });

  /**
   * This is the acceptance criterion that matters most for issue #13:
   * a brand-new rail must be usable without editing PaymentRoutingEngine.
   * If this test ever requires an engine change to pass, the abstraction is decorative.
   */
  it("accepts a rail type the engine has never seen, without modification", async () => {
    const exoticRail = stubRail(
      "LIQUIDITY_VAULT",
      [[CrossChainDomain.STELLAR, CrossChainDomain.AVALANCHE]],
      "0xexotic"
    );

    const engine = new PaymentRoutingEngine([]);
    engine.registerRail(exoticRail);

    const intent = await engine.routePayment({
      ...baseRequest,
      sourceDomain: CrossChainDomain.STELLAR,
      destinationDomain: CrossChainDomain.AVALANCHE,
    });

    expect(intent.destinationTxHash).toBe("0xexotic");
    expect(exoticRail.executeSettlement).toHaveBeenCalledOnce();
  });

  it("throws UnsupportedRouteError when no rail supports the route", async () => {
    const engine = new PaymentRoutingEngine([
      stubRail("LIQUIDITY_VAULT", [[CrossChainDomain.HASHKEY_CHAIN, CrossChainDomain.STELLAR]]),
    ]);

    await expect(
      engine.routePayment({
        ...baseRequest,
        sourceDomain: CrossChainDomain.AVALANCHE,
        destinationDomain: CrossChainDomain.STELLAR,
      })
    ).rejects.toThrow(UnsupportedRouteError);
  });

  it("marks the intent COMPLETED and records the settlement hash on success", async () => {
    const engine = new PaymentRoutingEngine([
      stubRail(
        "LIQUIDITY_VAULT",
        [[CrossChainDomain.HASHKEY_CHAIN, CrossChainDomain.STELLAR]],
        "0xsettled"
      ),
    ]);

    const intent = await engine.routePayment(baseRequest);

    expect(intent.status).toBe(BridgePaymentStatus.COMPLETED);
    expect(intent.destinationTxHash).toBe("0xsettled");
    expect(intent.createdAt).toBeInstanceOf(Date);
  });

  it("marks the intent FAILED and rethrows when the rail throws", async () => {
    const failingRail: ISettlementRail = {
      railType: "LIQUIDITY_VAULT",
      supportsRoute: () => true,
      estimateFee: vi.fn().mockResolvedValue(0n),
      executeSettlement: vi.fn().mockRejectedValue(new Error("rail exploded")),
    };

    const engine = new PaymentRoutingEngine([failingRail]);

    await expect(engine.routePayment(baseRequest)).rejects.toThrow("rail exploded");

    const stored = await engine.getPaymentStatus(baseRequest.paymentId);
    expect(stored?.status).toBe(BridgePaymentStatus.FAILED);
  });

  it("exposes stored payments by id and returns null for unknown ids", async () => {
    const engine = new PaymentRoutingEngine([
      stubRail("LIQUIDITY_VAULT", [[CrossChainDomain.HASHKEY_CHAIN, CrossChainDomain.STELLAR]]),
    ]);

    await engine.routePayment(baseRequest);

    const found = await engine.getPaymentStatus(baseRequest.paymentId);
    expect(found?.paymentId).toBe(baseRequest.paymentId);

    const missing = await engine.getPaymentStatus(
      "0xdead000000000000000000000000000000000000000000000000000000000000"
    );
    expect(missing).toBeNull();
  });

  it("delegates fee estimation to the rail that owns the route", async () => {
    const rail = stubRail("LIQUIDITY_VAULT", [
      [CrossChainDomain.HASHKEY_CHAIN, CrossChainDomain.STELLAR],
    ]);
    (rail.estimateFee as ReturnType<typeof vi.fn>).mockResolvedValue(1_500n);

    const engine = new PaymentRoutingEngine([rail]);

    const fee = await engine.estimateFee(
      CrossChainDomain.HASHKEY_CHAIN,
      CrossChainDomain.STELLAR,
      100n * 1_000_000n
    );

    expect(fee).toBe(1_500n);
  });
});
