import { CrossChainDomain } from "@zip-0/cctp-bridge/dist/core/types.js";

export interface ChainInfo {
  name: string;
  chainId: number;
  domain: CrossChainDomain | number;
  type: "evm" | "stellar";
}

export const CHAIN_REGISTRY: Record<string, ChainInfo> = {
  avalanche: {
    name: "avalanche",
    chainId: 43113,
    domain: CrossChainDomain.AVALANCHE,
    type: "evm",
  },
  hashkey: {
    name: "hashkey",
    chainId: 133,
    domain: CrossChainDomain.HASHKEY_CHAIN,
    type: "evm",
  },
  stellar: {
    name: "stellar",
    chainId: 148,
    domain: CrossChainDomain.STELLAR,
    type: "stellar",
  },
  ethereum: {
    name: "ethereum",
    chainId: 1,
    domain: 0,
    type: "evm",
  },
  polygon: {
    name: "polygon",
    chainId: 137,
    domain: 7,
    type: "evm",
  },
  arbitrum: {
    name: "arbitrum",
    chainId: 42161,
    domain: 3,
    type: "evm",
  },
  base: {
    name: "base",
    chainId: 8453,
    domain: 6,
    type: "evm",
  },
};

export function resolveChain(identifier: string | number): ChainInfo {
  if (typeof identifier === "number") {
    const found = Object.values(CHAIN_REGISTRY).find((c) => c.chainId === identifier);
    if (found) return found;
    return {
      name: `chain-${identifier}`,
      chainId: identifier,
      domain: identifier,
      type: "evm",
    };
  }

  const normalized = identifier.toLowerCase().trim();
  const found = CHAIN_REGISTRY[normalized];
  if (found) return found;

  const numeric = parseInt(identifier, 10);
  if (!isNaN(numeric)) {
    return resolveChain(numeric);
  }

  throw new Error(`Unsupported or unknown chain identifier: "${identifier}"`);
}
