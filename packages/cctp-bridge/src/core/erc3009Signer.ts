import { parseSignature, type LocalAccount, type PublicClient } from "viem";
import { ERC3009_TYPES, getUsdcDomain } from "./erc3009.js";
import { AuthorizationPayload } from "./types.js";
import { BridgeError, ErrorCode } from "./errors.js";

/**
 * Builds and signs ERC-3009 `TransferWithAuthorization` payloads, and validates them before they
 * are submitted. The signing domain mirrors Circle USDC exactly (name "USD Coin", version "2"),
 * so the same payload works against native USDC on Avalanche and bridged USDC.e on HashKey.
 */

export const AUTHORIZATION_STATE_ABI = [
  {
    name: "authorizationState",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "authorizer", type: "address" },
      { name: "nonce", type: "bytes32" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export interface TransferWithAuthorizationParams {
  chainId: number;
  tokenAddress: `0x${string}`;
  from: `0x${string}`;
  to: `0x${string}`;
  value: bigint;
  validAfter: number | bigint;
  validBefore: number | bigint;
  nonce: `0x${string}`;
}

/** Builds the EIP-712 message. Exposed separately so callers can hash or inspect it. */
export function buildTransferWithAuthorizationMessage(params: TransferWithAuthorizationParams) {
  if (params.validBefore <= params.validAfter) {
    throw new BridgeError(
      ErrorCode.INVALID_SIGNATURE,
      `Invalid authorization window: validAfter (${params.validAfter}) must be before validBefore (${params.validBefore})`
    );
  }

  return {
    from: params.from,
    to: params.to,
    value: params.value,
    validAfter: BigInt(params.validAfter),
    validBefore: BigInt(params.validBefore),
    nonce: params.nonce,
  };
}

/**
 * Signs a `TransferWithAuthorization` payload. The returned `AuthorizationPayload` is exactly what
 * `ZIP0PaymentVault.depositWithAuthorization(...)` expects after splitting into `v`, `r`, `s`.
 */
export async function signTransferWithAuthorization(
  account: LocalAccount,
  params: TransferWithAuthorizationParams
): Promise<AuthorizationPayload> {
  const message = buildTransferWithAuthorizationMessage(params);

  const signature = await account.signTypedData({
    domain: getUsdcDomain(params.chainId, params.tokenAddress),
    types: ERC3009_TYPES,
    primaryType: "TransferWithAuthorization",
    message,
  });

  const parsed = parseSignature(signature);

  return {
    from: params.from,
    to: params.to,
    value: params.value,
    validAfter: Number(params.validAfter),
    validBefore: Number(params.validBefore),
    nonce: params.nonce,
    v: Number(parsed.v),
    r: parsed.r,
    s: parsed.s,
  };
}

/** Rejects a payload whose validity window has not opened or has already closed. */
export function assertAuthorizationWindow(
  payload: Pick<AuthorizationPayload, "validAfter" | "validBefore">,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): void {
  if (nowSeconds > payload.validBefore) {
    throw new BridgeError(
      ErrorCode.INVALID_SIGNATURE,
      `Authorization expired: validBefore=${payload.validBefore}, now=${nowSeconds}`
    );
  }

  if (nowSeconds < payload.validAfter) {
    throw new BridgeError(
      ErrorCode.INVALID_SIGNATURE,
      `Authorization not yet valid: validAfter=${payload.validAfter}, now=${nowSeconds}`
    );
  }
}

/** Reads the token's on-chain `authorizationState(authorizer, nonce)`. */
export async function isAuthorizationUsed(
  publicClient: PublicClient,
  tokenAddress: `0x${string}`,
  from: `0x${string}`,
  nonce: `0x${string}`
): Promise<boolean> {
  return publicClient.readContract({
    address: tokenAddress,
    abi: AUTHORIZATION_STATE_ABI,
    functionName: "authorizationState",
    args: [from, nonce],
  });
}

/**
 * Validates a signed authorization before submitting it, so we fail fast instead of burning gas on
 * a replayed nonce or an expired window.
 */
export async function assertAuthorizationUsable(
  publicClient: PublicClient,
  tokenAddress: `0x${string}`,
  payload: AuthorizationPayload
): Promise<void> {
  assertAuthorizationWindow(payload);

  if (await isAuthorizationUsed(publicClient, tokenAddress, payload.from, payload.nonce)) {
    throw new BridgeError(
      ErrorCode.INVALID_SIGNATURE,
      `Nonce ${payload.nonce} has already been used on-chain for ${payload.from}`
    );
  }
}
