import { describe, it, expect, vi } from "vitest";
import { recoverTypedDataAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  assertAuthorizationUsable,
  assertAuthorizationWindow,
  ERC3009_TYPES,
  getUsdcDomain,
  signTransferWithAuthorization,
} from "../src/index.js";
import { ErrorCode } from "../src/core/errors.js";

const account = privateKeyToAccount(
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
);
const TOKEN = "0x5425890298aed601595a70ab815c96711a31bc65" as const;
const TO = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as const;
const NONCE = `0x${"ab".repeat(32)}` as const;
const CHAIN_ID = 43113;

describe("ERC-3009 signing helper", () => {
  it("produces a signature that recovers to the payer under the USDC domain", async () => {
    const now = Math.floor(Date.now() / 1000);
    const payload = await signTransferWithAuthorization(account, {
      chainId: CHAIN_ID,
      tokenAddress: TOKEN,
      from: account.address,
      to: TO,
      value: 1_000_000n,
      validAfter: now - 60,
      validBefore: now + 3600,
      nonce: NONCE,
    });

    expect([27, 28]).toContain(payload.v);
    expect(payload.from).toBe(account.address);

    const recovered = await recoverTypedDataAddress({
      domain: getUsdcDomain(CHAIN_ID, TOKEN),
      types: ERC3009_TYPES,
      primaryType: "TransferWithAuthorization",
      message: {
        from: payload.from,
        to: payload.to,
        value: payload.value,
        validAfter: BigInt(payload.validAfter),
        validBefore: BigInt(payload.validBefore),
        nonce: payload.nonce,
      },
      signature: `0x${payload.r.slice(2)}${payload.s.slice(2)}${payload.v
        .toString(16)
        .padStart(2, "0")}`,
    });

    expect(recovered.toLowerCase()).toBe(account.address.toLowerCase());
  });

  it("rejects an inverted validity window before signing", async () => {
    await expect(
      signTransferWithAuthorization(account, {
        chainId: CHAIN_ID,
        tokenAddress: TOKEN,
        from: account.address,
        to: TO,
        value: 1n,
        validAfter: 200,
        validBefore: 100,
        nonce: NONCE,
      })
    ).rejects.toMatchObject({ code: ErrorCode.INVALID_SIGNATURE });
  });

  it("rejects an expired authorization", () => {
    expect(() => assertAuthorizationWindow({ validAfter: 0, validBefore: 100 }, 200)).toThrow(
      /expired/
    );
  });

  it("rejects an authorization that is not yet valid", () => {
    expect(() => assertAuthorizationWindow({ validAfter: 500, validBefore: 1000 }, 200)).toThrow(
      /not yet valid/
    );
  });

  it("accepts a payload inside its window and unused on-chain", async () => {
    const publicClient = { readContract: vi.fn().mockResolvedValue(false) };
    const now = Math.floor(Date.now() / 1000);

    await expect(
      assertAuthorizationUsable(publicClient as never, TOKEN, {
        from: account.address,
        to: TO,
        value: 1n,
        validAfter: now - 60,
        validBefore: now + 3600,
        nonce: NONCE,
        v: 27,
        r: `0x${"11".repeat(32)}`,
        s: `0x${"22".repeat(32)}`,
      })
    ).resolves.toBeUndefined();
  });

  it("fails fast when the nonce is already used on-chain", async () => {
    const publicClient = { readContract: vi.fn().mockResolvedValue(true) };
    const now = Math.floor(Date.now() / 1000);

    await expect(
      assertAuthorizationUsable(publicClient as never, TOKEN, {
        from: account.address,
        to: TO,
        value: 1n,
        validAfter: now - 60,
        validBefore: now + 3600,
        nonce: NONCE,
        v: 27,
        r: `0x${"11".repeat(32)}`,
        s: `0x${"22".repeat(32)}`,
      })
    ).rejects.toMatchObject({ code: ErrorCode.INVALID_SIGNATURE });
  });
});
