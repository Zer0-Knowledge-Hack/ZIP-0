export * from "./core/types.js";
export * from "./core/interfaces.js";
export * from "./core/errors.js";
export * from "./core/router.js";
export * from "./core/erc3009.js";
export * from "./core/erc3009Signer.js";
export * from "./adapters/evm/client.js";
export * from "./adapters/hsk/client.js";
export * from "./adapters/pollar/client.js";
export * from "./adapters/pollar/polygonClient.js";
export * from "./adapters/cctp/cctpRail.js";
export * from "./adapters/vault/vaultRail.js";
export { VaultSettlementRail as EvmStellarVaultRail } from "./rails/vault-settlement-rail.js";
export * from "./relayer/orchestrator.js";
export * from "./relayer/erc3009Relayer.js";
export * from "./api/gateway.js";

import { EvmAdapter } from "./adapters/evm/client.js";
import { PollarStellarAdapter } from "./adapters/pollar/client.js";
import { RelayerOrchestrator } from "./relayer/orchestrator.js";
import { EvmVaultConfig, HskVaultConfig, PollarConfig, PaymentIntent, PaymentQuote } from "./core/types.js";
import { PaymentRoutingEngine } from "./core/router.js";
import { CctpSettlementRail } from "./adapters/cctp/cctpRail.js";
import { VaultSettlementRail } from "./adapters/vault/vaultRail.js";
import { PaymentApiGateway, CreateQuoteRequest, CreateTransferRequest } from "./api/gateway.js";

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

  startEvmRelayListener(): () => void {
    return this.evmAdapter.onPaymentInitiated(async (intent) => {
      await this.relayer.handleHskToStellar(intent);
    });
  }

  startHskRelayListener(): () => void {
    return this.startEvmRelayListener();
  }
}

export interface Zip0ClientOptions {
  apiKey?: string;
  gatewayUrl?: string;
  evmAdapter?: EvmAdapter;
}

export class Zip0Client {
  public readonly router: PaymentRoutingEngine;
  public readonly gateway: PaymentApiGateway;

  constructor(options: Zip0ClientOptions = {}) {
    this.router = new PaymentRoutingEngine();

    // Default CCTP rail
    this.router.registerRail(new CctpSettlementRail());

    // If EVM vault adapter provided, register Vault rail
    if (options.evmAdapter) {
      this.router.registerRail(new VaultSettlementRail(options.evmAdapter));
    }

    this.gateway = new PaymentApiGateway(this.router);
  }

  public get payments() {
    return {
      quote: async (req: CreateQuoteRequest): Promise<PaymentQuote> => {
        return this.gateway.handleQuote(req);
      },
      create: async (req: CreateTransferRequest): Promise<PaymentIntent> => {
        return this.gateway.handleTransfer(req);
      },
      get: async (paymentId: `0x${string}`) => {
        return this.gateway.handleGetStatus(paymentId);
      },
    };
  }
}
