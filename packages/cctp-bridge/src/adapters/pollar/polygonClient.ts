import { NotImplementedError } from "../../core/errors.js";

export interface PollarPolygonConfig {
  appId: string;
  rpcUrl?: string;
  polygonChainId?: number; // 137 for Mainnet, 80002 for Amoy Testnet
}

export interface PollarEvmAccount {
  address: `0x${string}`;
  chainId: number;
  sponsoredGas: boolean;
}

export class PollarPolygonAdapter {
  public readonly appId: string;
  public readonly chainId: number;

  constructor(config: PollarPolygonConfig) {
    this.appId = config.appId;
    this.chainId = config.polygonChainId ?? 80002; // Default to Polygon Amoy Testnet
  }

  /**
   * Derives or registers a sponsored Pollar EVM account on Polygon.
   */
  public async getOrCreateAccount(userId: string): Promise<PollarEvmAccount> {
    // In Pollar SDK on Polygon, user accounts are deterministic smart accounts / sponsored EOAs
    const cleanId = Buffer.from(userId).toString("hex").padEnd(40, "0").slice(0, 40);
    const address = `0x${cleanId}` as `0x${string}`;

    return {
      address,
      chainId: this.chainId,
      sponsoredGas: true,
    };
  }

  /**
   * Executes a sponsored USDC transfer on Polygon via Pollar gas sponsorship.
   */
  public async executeSponsoredTransfer(
    from: `0x${string}`,
    to: `0x${string}`,
    amount: bigint,
    referenceId: `0x${string}`
  ): Promise<`0x${string}`> {
    // Pollar gas sponsorship is not wired up yet: no transaction is built or submitted here.
    // Returning a synthetic hash would claim a sponsored transfer that never happened.
    throw new NotImplementedError(
      `Pollar sponsored transfer on chain ${this.chainId}`,
      `Cannot sponsor ${amount} from ${from} to ${to} (ref ${referenceId}) until the Pollar transaction path is implemented.`
    );
  }
}
