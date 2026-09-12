import { Erc3009Authorizer } from "../core/erc3009.js";
import { AuthorizationPayload } from "../core/types.js";
import { BridgeError, ErrorCode, NotImplementedError } from "../core/errors.js";

export interface Erc3009RelayerConfig {
  chainId: number;
  usdcAddress: `0x${string}`;
  relayerPrivateKey?: `0x${string}`;
}

export class Erc3009Relayer {
  private authorizer: Erc3009Authorizer;
  private config: Erc3009RelayerConfig;

  constructor(config: Erc3009RelayerConfig, authorizer?: Erc3009Authorizer) {
    this.config = config;
    this.authorizer = authorizer ?? new Erc3009Authorizer();
  }

  public async relayAuthorization(payload: AuthorizationPayload): Promise<`0x${string}`> {
    // 1. Verify EIP-712 signature & anti-replay
    const isValid = await this.authorizer.verifyAuthorization(
      payload,
      this.config.chainId,
      this.config.usdcAddress
    );

    if (!isValid) {
      throw new BridgeError(
        ErrorCode.INVALID_SIGNATURE,
        "ERC-3009 signature verification failed"
      );
    }

    // 2. Mark nonce consumed
    this.authorizer.markNonceConsumed(payload.from, payload.nonce);

    // 3. Broadcast transferWithAuthorization, with the relayer paying gas.
    //
    // Steps 1 and 2 above are real: the EIP-712 signature is recovered and validated against
    // the payer, and the nonce is marked consumed. Only the broadcast is missing — tracked in
    // issue #15. Returning a synthetic hash here would report a transfer that never occurred.
    throw new NotImplementedError(
      `ERC-3009 broadcast on chain ${this.config.chainId}`,
      "The authorization signature was verified successfully; submitting it on-chain still requires a writeContract call to transferWithAuthorization."
    );
  }
}
