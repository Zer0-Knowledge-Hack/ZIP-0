import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbiItem,
  parseAbi,
  Address,
  Hex,
  defineChain,
  PublicClient,
  WalletClient,
  Account,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { IEvmAdapter } from "../../core/interfaces.js";
import {
  BridgePaymentStatus,
  CrossChainDomain,
  EvmVaultConfig,
  PaymentIntent,
} from "../../core/types.js";
import { RelayerExecutionError } from "../../core/errors.js";

export const avalancheFujiChain = defineChain({
  id: 43113,
  name: "Avalanche Fuji Testnet",
  nativeCurrency: { name: "AVAX", symbol: "AVAX", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://api.avax-test.network/ext/bc/C/rpc"] },
  },
  blockExplorers: {
    default: {
      name: "SnowTrace",
      url: "https://testnet.snowtrace.io",
    },
  },
});

export const hashkeyTestnet = defineChain({
  id: 133,
  name: "HashKey Chain Testnet",
  nativeCurrency: { name: "HSK", symbol: "HSK", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://hashkeychain-testnet.alt.technology"] },
  },
  blockExplorers: {
    default: {
      name: "HashKey Explorer",
      url: "https://hashkeychain-testnet-explorer.alt.technology",
    },
  },
});

export const hardhatLocal = defineChain({
  id: 31337,
  name: "Hardhat Local",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["http://127.0.0.1:8545"] },
  },
});

function resolveChain(chainId: number, rpcUrl: string) {
  if (chainId === 43113) return avalancheFujiChain;
  if (chainId === 133) return hashkeyTestnet;
  if (chainId === 31337) return hardhatLocal;
  return defineChain({
    id: chainId,
    name: `EVM Chain ${chainId}`,
    nativeCurrency: { name: "Gas", symbol: "GAS", decimals: 18 },
    rpcUrls: {
      default: { http: [rpcUrl] },
    },
  });
}

const VAULT_ABI = parseAbi([
  "function depositPayment(bytes32 paymentId, uint256 amount, uint32 destinationDomain, bytes32 destinationRecipient, bytes calldata metadata) external",
  "function releasePayment(bytes32 paymentId, address recipient, uint256 amount) external",
  "function usdcToken() view returns (address)",
  "event PaymentInitiated(bytes32 indexed paymentId, address indexed payer, uint256 amount, uint32 destinationDomain, bytes32 destinationRecipient, bytes metadata)",
  "event PaymentReleased(bytes32 indexed paymentId, address indexed recipient, uint256 amount, address relayer)",
]);

export class EvmAdapter implements IEvmAdapter {
  public publicClient: PublicClient;
  private walletClient?: WalletClient;
  private account?: Account;
  private vaultAddress: Address;
  private usdcAddress: Address;
  private chain: ReturnType<typeof resolveChain>;

  constructor(config: EvmVaultConfig) {
    this.vaultAddress = config.vaultAddress;
    this.usdcAddress = config.usdcAddress;
    this.chain = resolveChain(config.chainId, config.rpcUrl);

    this.publicClient = createPublicClient({
      chain: this.chain,
      transport: http(config.rpcUrl),
    });

    if (config.relayerPrivateKey) {
      this.account = privateKeyToAccount(config.relayerPrivateKey);
      this.walletClient = createWalletClient({
        account: this.account,
        chain: this.chain,
        transport: http(config.rpcUrl),
      });
    }
  }

  async depositPayment(intent: Omit<PaymentIntent, "status" | "createdAt">): Promise<Hex> {
    if (!this.walletClient || !this.account) {
      throw new RelayerExecutionError("Wallet client required to deposit payment");
    }

    const hash = await this.walletClient.writeContract({
      address: this.vaultAddress,
      abi: VAULT_ABI,
      functionName: "depositPayment",
      args: [
        intent.paymentId,
        intent.amount,
        intent.destinationDomain,
        intent.destinationRecipient as Hex,
        "0x",
      ],
      account: this.account,
      chain: this.chain,
    });

    await this.publicClient.waitForTransactionReceipt({ hash });
    return hash;
  }

  async releasePayment(paymentId: Hex, recipient: Address, amount: bigint): Promise<Hex> {
    if (!this.walletClient || !this.account) {
      throw new RelayerExecutionError("Relayer wallet client required to release payments");
    }

    try {
      const hash = await this.walletClient.writeContract({
        address: this.vaultAddress,
        abi: VAULT_ABI,
        functionName: "releasePayment",
        args: [paymentId, recipient, amount],
        account: this.account,
        chain: this.chain,
      });

      await this.publicClient.waitForTransactionReceipt({ hash });
      return hash;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new RelayerExecutionError(`releasePayment failed on EVM (Chain ${this.chain.id}): ${message}`, err);
    }
  }

  async getVaultBalance(): Promise<bigint> {
    const balance = (await this.publicClient.readContract({
      address: this.usdcAddress,
      abi: [
        {
          name: "balanceOf",
          type: "function",
          inputs: [{ name: "account", type: "address" }],
          outputs: [{ name: "", type: "uint256" }],
          stateMutability: "view",
        },
      ],
      functionName: "balanceOf",
      args: [this.vaultAddress],
    })) as bigint;

    return balance;
  }

  async getAccountUsdcBalance(accountAddress: Address): Promise<bigint> {
    const balance = (await this.publicClient.readContract({
      address: this.usdcAddress,
      abi: [
        {
          name: "balanceOf",
          type: "function",
          inputs: [{ name: "account", type: "address" }],
          outputs: [{ name: "", type: "uint256" }],
          stateMutability: "view",
        },
      ],
      functionName: "balanceOf",
      args: [accountAddress],
    })) as bigint;

    return balance;
  }

  onPaymentInitiated(callback: (intent: PaymentIntent) => Promise<void>): () => void {
    const unwatch = this.publicClient.watchEvent({
      address: this.vaultAddress,
      event: parseAbiItem(
        "event PaymentInitiated(bytes32 indexed paymentId, address indexed payer, uint256 amount, uint32 destinationDomain, bytes32 destinationRecipient, bytes metadata)"
      ),
      onLogs: async (logs) => {
        for (const log of logs) {
          const { paymentId, payer, amount, destinationDomain, destinationRecipient } =
            log.args as {
              paymentId: Hex;
              payer: Address;
              amount: bigint;
              destinationDomain: number;
              destinationRecipient: Hex;
            };

          const domain =
            this.chain.id === 43113
              ? CrossChainDomain.AVALANCHE
              : CrossChainDomain.HASHKEY_CHAIN;

          const intent: PaymentIntent = {
            paymentId,
            sourcePayer: payer,
            amount,
            sourceDomain: domain,
            destinationDomain: destinationDomain as CrossChainDomain,
            destinationRecipient,
            status: BridgePaymentStatus.PROCESSING,
            createdAt: new Date(),
            sourceTxHash: log.transactionHash,
          };

          await callback(intent);
        }
      },
    });

    return unwatch;
  }
}
