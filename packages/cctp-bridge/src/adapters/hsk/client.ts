import { EvmAdapter, hashkeyTestnet } from "../evm/client.js";
import { HskVaultConfig } from "../../core/types.js";

export { hashkeyTestnet };

/**
 * HSK Adapter for ZIP-0 Vault on HashKey Chain Testnet.
 * Extends universal EvmAdapter.
 */
export class HskAdapter extends EvmAdapter {
  constructor(config: HskVaultConfig) {
    super(config);
  }
}
