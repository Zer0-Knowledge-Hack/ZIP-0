import { describe, expect, it } from "vitest";
import { formatBlock, formatLiquidity, HSK_TESTNET, USDC_DECIMALS } from "./chain";

describe("formatLiquidity", () => {
  it("renders a whole amount with two decimals", () => {
    expect(formatLiquidity(50_000n * 10n ** BigInt(USDC_DECIMALS), "en-US")).toBe("50,000.00");
  });

  it("keeps the fractional part", () => {
    expect(formatLiquidity(1_234_560_000n, "en-US")).toBe("1,234.56");
  });

  it("pads a single-digit cents value", () => {
    // 1.05 USDC — the naive implementation drops the zero and reads as 1.5.
    expect(formatLiquidity(1_050_000n, "en-US")).toBe("1.05");
  });

  it("truncates rather than rounding up", () => {
    // 0.999999 must never present as 1.00: overstating available liquidity is the direction
    // that misleads someone deciding whether a payment will settle.
    expect(formatLiquidity(999_999n, "en-US")).toBe("0.99");
  });

  it("uses the locale decimal separator and grouping", () => {
    // Five digits, not four: Spanish ICU deliberately omits the grouping separator for four-digit
    // integers, so 1234,56 is correct there and would make this a test of the wrong thing.
    expect(formatLiquidity(12_345_560_000n, "es-ES")).toBe("12.345,56");
  });

  it("handles an empty vault", () => {
    expect(formatLiquidity(0n, "en-US")).toBe("0.00");
  });

  it("does not lose precision on amounts beyond Number.MAX_SAFE_INTEGER", () => {
    const huge = 9_007_199_254_740_993n * 10n ** BigInt(USDC_DECIMALS);
    expect(formatLiquidity(huge, "en-US")).toBe("9,007,199,254,740,993.00");
  });
});

describe("formatBlock", () => {
  it("groups long block heights", () => {
    expect(formatBlock(12_345_678n, "en-US")).toBe("12,345,678");
  });
});

describe("HSK_TESTNET", () => {
  it("targets chain 133 on the live RPC host", () => {
    // The decommissioned alt.technology endpoints cost this project real time (#2). Pin it.
    expect(HSK_TESTNET.id).toBe(133);
    expect(HSK_TESTNET.rpcUrls.default.http[0]).toBe("https://testnet.hsk.xyz");
  });
});
