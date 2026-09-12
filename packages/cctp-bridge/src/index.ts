export * from "./core/types.js";
export * from "./core/interfaces.js";
export * from "./core/errors.js";
export * from "./adapters/evm/client.js";
export * from "./adapters/hsk/client.js";
export * from "./adapters/pollar/client.js";
export * from "./relayer/orchestrator.js";

import { EvmAdapter } from "./adapters/evm/client.js";
import { PollarStellarAdapter } from "./adapters/pollar/client.js";
import { RelayerOrchestrator } from "./relayer/orchestrator.js";
import { EvmVaultConfig, HskVaultConfig, PollarConfig } from "./core/types.js";

export interface BridgeClientConfig {
  evm?: EvmVaultConfig;
  hsk?: HskVaultConfig;
  pollar: PollarConfig;
}

export class BridgeClient {
  public readonly evmAdapter: EvmAdapter;
  public readonly pollarAdapter: PollarStellarAdapter;
  public readonly relayer: RelayerOrchestrator;

  constructor(config: BridgeClientConfig) {
    const evmConfig = config.evm || config.hsk;
    if (!evmConfig) {
      throw new Error("EVM configuration required for BridgeClient");
    }
    this.evmAdapter = new EvmAdapter(evmConfig);
    this.pollarAdapter = new PollarStellarAdapter(config.pollar);
    this.relayer = new RelayerOrchestrator(this.evmAdapter, this.pollarAdapter);
  }

  get hskAdapter(): EvmAdapter {
    return this.evmAdapter;
  }

  /**
   * Starts listening to on-chain EVM deposit events and relays them to Stellar via Pollar.
   */
  startEvmRelayListener(): () => void {
    return this.evmAdapter.onPaymentInitiated(async (intent) => {
      await this.relayer.handleHskToStellar(intent);
    });
  }

  startHskRelayListener(): () => void {
    return this.startEvmRelayListener();
  }
}
