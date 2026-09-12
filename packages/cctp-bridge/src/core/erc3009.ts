import { recoverTypedDataAddress } from "viem";
import { AuthorizationPayload } from "./types.js";
import { BridgeError, ErrorCode } from "./errors.js";

export const ERC3009_TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

export function getUsdcDomain(chainId: number, verifyingContract: `0x${string}`) {
  return {
    name: "USD Coin",
    version: "2",
    chainId: BigInt(chainId),
    verifyingContract,
  } as const;
}

export class Erc3009Authorizer {
  private consumedNonces = new Set<string>();

  public generateNonce(): `0x${string}` {
    const randomHex = Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 256)
        .toString(16)
        .padStart(2, "0")
    ).join("");
    return `0x${randomHex}` as `0x${string}`;
  }

  public isNonceConsumed(from: `0x${string}`, nonce: `0x${string}`): boolean {
    return this.consumedNonces.has(`${from.toLowerCase()}:${nonce.toLowerCase()}`);
  }

  public markNonceConsumed(from: `0x${string}`, nonce: `0x${string}`): void {
    this.consumedNonces.add(`${from.toLowerCase()}:${nonce.toLowerCase()}`);
  }

  public async verifyAuthorization(
    payload: AuthorizationPayload,
    chainId: number,
    usdcAddress: `0x${string}`
  ): Promise<boolean> {
    const now = Math.floor(Date.now() / 1000);

    if (now > payload.validBefore) {
      throw new BridgeError(
        ErrorCode.INVALID_SIGNATURE,
        `Authorization expired: validBefore=${payload.validBefore}, now=${now}`
      );
    }

    if (now < payload.validAfter) {
      throw new BridgeError(
        ErrorCode.INVALID_SIGNATURE,
        `Authorization not yet valid: validAfter=${payload.validAfter}, now=${now}`
      );
    }

    if (this.isNonceConsumed(payload.from, payload.nonce)) {
      throw new BridgeError(
        ErrorCode.INVALID_SIGNATURE,
        `Nonce ${payload.nonce} already consumed for address ${payload.from}`
      );
    }

    // Reconstruct 65-byte signature from r, s, v
    const cleanR = payload.r.replace("0x", "").padStart(64, "0");
    const cleanS = payload.s.replace("0x", "").padStart(64, "0");
    const cleanV = payload.v.toString(16).padStart(2, "0");
    const signature = `0x${cleanR}${cleanS}${cleanV}` as `0x${string}`;

    try {
      const recovered = await recoverTypedDataAddress({
        domain: getUsdcDomain(chainId, usdcAddress),
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
        signature,
      });

      const isValid = recovered.toLowerCase() === payload.from.toLowerCase();
      if (!isValid) {
        throw new BridgeError(
          ErrorCode.INVALID_SIGNATURE,
          `Recovered signer ${recovered} does not match from ${payload.from}`
        );
      }
      return true;
    } catch (err: unknown) {
      if (err instanceof BridgeError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      throw new BridgeError(ErrorCode.INVALID_SIGNATURE, `EIP-712 recovery failed: ${msg}`);
    }
  }
}
