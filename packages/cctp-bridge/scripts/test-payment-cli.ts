import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";
import { createWalletClient, formatUnits, http, parseAbi, parseUnits, type Chain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  avalancheFujiChain,
  EvmAdapter,
  hashkeyTestnet,
} from "../src/adapters/evm/client.js";
import { PollarStellarAdapter } from "../src/adapters/pollar/client.js";
import { RelayerOrchestrator } from "../src/relayer/orchestrator.js";
import { CrossChainDomain, PaymentIntent, BridgePaymentStatus } from "../src/core/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../contracts-evm/.env") });

/** Submission artifact from #3. Missing acknowledgePayment — Flow 2 reverts against it. */
const LEGACY_HSK_VAULT = "0x14e59806054773fc341377aEC472C07e500BCc86".toLowerCase();

interface EvmNetworkProfile {
  chainId: number;
  name: string;
  rpcUrl: string;
  explorerName: string;
  explorerTx: (hash: string) => string;
  vaultAddress: `0x${string}`;
  usdcAddress: `0x${string}`;
  usdcLabel: string;
  domain: CrossChainDomain;
  chain: Chain;
}

const HSK_TESTNET: EvmNetworkProfile = {
  chainId: 133,
  name: "HashKey Chain Testnet",
  rpcUrl: "https://testnet.hsk.xyz",
  explorerName: "HSK Explorer",
  explorerTx: (hash) => `https://testnet-explorer.hsk.xyz/tx/${hash}`,
  vaultAddress: "0x3028a9AfCD5E2c3C2E1fD35d984Be65640ca4e07",
  usdcAddress: "0x1f65E72EE31F709969Dfc75f98f5867EaE332CD9",
  usdcLabel: "MockUSDC",
  domain: CrossChainDomain.HASHKEY_CHAIN,
  chain: hashkeyTestnet,
};

const AVALANCHE_FUJI: EvmNetworkProfile = {
  chainId: 43113,
  name: "Avalanche Fuji Testnet",
  rpcUrl: "https://api.avax-test.network/ext/bc/C/rpc",
  explorerName: "SnowTrace",
  explorerTx: (hash) => `https://testnet.snowtrace.io/tx/${hash}`,
  vaultAddress: "0x9B9D238D3b7dfAdF87b6096889fcE2fe39d76f50",
  usdcAddress: "0x5425890298aed601595a70ab815c96711a31bc65",
  usdcLabel: "Circle USDC",
  domain: CrossChainDomain.AVALANCHE,
  chain: avalancheFujiChain,
};

interface TestWalletsConfig {
  evm?: { users?: { alice?: { address: `0x${string}`; privateKey: `0x${string}` }; bob?: { address: `0x${string}` } } };
  stellar?: { users?: { charlie?: { publicKey: string; secretKey: string } } };
}
let testWallets: TestWalletsConfig | null = null;
const walletsPath = path.resolve(__dirname, "../../contracts-evm/wallets/test-wallets.json");
if (fs.existsSync(walletsPath)) {
  try {
    testWallets = JSON.parse(fs.readFileSync(walletsPath, "utf-8")) as TestWalletsConfig;
  } catch {
    // ignore
  }
}

/**
 * Resolves a secret from the first environment variable that is set.
 *
 * Never falls back to a literal. A committed fallback key is a published key: this script
 * previously shipped working private keys, and the repository is public. Failing loudly is
 * the only safe behaviour.
 */
function requireSecret(label: string, envVars: string[], fromWallets?: string): `0x${string}` {
  const value = envVars.map((name) => process.env[name]).find(Boolean) ?? fromWallets;

  if (!value) {
    throw new Error(
      `Missing ${label}. Set one of: ${envVars.join(", ")} in packages/cctp-bridge/.env ` +
        `(or provide wallets/test-wallets.json). Never hardcode a key — this repository is public.`
    );
  }

  return value.trim() as `0x${string}`;
}

function resolveNetwork(): EvmNetworkProfile {
  const requestedChainId = parseInt(process.env.EVM_CHAIN_ID || String(HSK_TESTNET.chainId), 10);
  const base = requestedChainId === AVALANCHE_FUJI.chainId ? AVALANCHE_FUJI : HSK_TESTNET;

  return {
    ...base,
    chainId: requestedChainId,
    rpcUrl: process.env.EVM_RPC_URL || base.rpcUrl,
    vaultAddress: (process.env.EVM_VAULT_ADDRESS || base.vaultAddress).trim() as `0x${string}`,
    usdcAddress: (process.env.EVM_USDC_ADDRESS || base.usdcAddress).trim() as `0x${string}`,
  };
}

function isFabricatedStellarHash(hash: string | undefined): boolean {
  return Boolean(hash?.startsWith("stellar-tx-"));
}

async function main() {
  const network = resolveNetwork();

  console.log("\n" + "=".repeat(70));
  console.log("   ZIP-0 PAYMENT BRIDGE — BIDIRECTIONAL CROSS-CHAIN RUNNER");
  console.log(`   Stellar (Pollar SDK) ⇄ ${network.name}`);
  console.log("=".repeat(70) + "\n");

  const pollarAppId = process.env.POLLAR_APP_ID || "cmty35mez000v0iobxbgcitxt";
  const horizonUrl = process.env.STELLAR_HORIZON_URL || "https://horizon-testnet.stellar.org";
  const relayerKey = requireSecret("relayer private key", [
    "RELAYER_PRIVATE_KEY",
    "PRIVATE_KEY",
  ]);

  const relayerAccount = privateKeyToAccount(relayerKey as `0x${string}`);

  const aliceKey = requireSecret(
    "test payer (alice) private key",
    ["ALICE_PRIVATE_KEY"],
    testWallets?.evm?.users?.alice?.privateKey
  );
  const aliceAccount = privateKeyToAccount(aliceKey);
  const aliceAddress = (process.env.ALICE_ADDRESS ||
    testWallets?.evm?.users?.alice?.address ||
    aliceAccount.address) as `0x${string}`;

  const bobAddress = (process.env.BOB_ADDRESS ||
    testWallets?.evm?.users?.bob?.address) as `0x${string}`;
  if (!bobAddress) {
    throw new Error(
      "Missing BOB_ADDRESS. Set BOB_ADDRESS in packages/cctp-bridge/.env or provide test-wallets.json"
    );
  }

  const charlieStellar =
    process.env.CHARLIE_STELLAR_ADDRESS ||
    testWallets?.stellar?.users?.charlie?.publicKey;
  if (!charlieStellar) {
    throw new Error(
      "Missing CHARLIE_STELLAR_ADDRESS. Set CHARLIE_STELLAR_ADDRESS in packages/cctp-bridge/.env or provide test-wallets.json"
    );
  }

  console.log("Configuration:");
  console.log(`  • Stellar Network:    Testnet (${horizonUrl})`);
  console.log(`  • Pollar App ID:      ${pollarAppId}`);
  console.log(`  • EVM Network:        ${network.name} (${network.chainId})`);
  console.log(`  • EVM RPC:            ${network.rpcUrl}`);
  console.log(`  • ${network.usdcLabel.padEnd(19)} ${network.usdcAddress}`);
  console.log(`  • ZIP0PaymentVault:   ${network.vaultAddress}`);
  console.log(`  • Relayer Wallet:     ${relayerAccount.address}`);
  console.log(`  • Test User (Alice):  ${aliceAddress} (EVM Buyer)`);
  console.log(`  • Test User (Bob):    ${bobAddress} (EVM Merchant)`);
  console.log(`  • Test User (Charlie):${charlieStellar} (Stellar Pollar Customer)`);
  console.log("-".repeat(70));

  if (network.vaultAddress.toLowerCase() === LEGACY_HSK_VAULT) {
    console.log(
      "\n  WARNING: this is the #3 HSK vault. It has no acknowledgePayment().\n" +
        "  Flow 2 (EVM → Stellar) will revert. Use 0x3028a9AfCD5E2c3C2E1fD35d984Be65640ca4e07."
    );
  }

  const isLiveTestnet = Boolean(
    network.vaultAddress && network.vaultAddress.startsWith("0x") && network.vaultAddress.length === 42
  );

  if (isLiveTestnet) {
    console.log(`\nMode: LIVE CROSS-CHAIN TESTNET (Stellar Testnet ⇄ ${network.name})`);

    const evmAdapter = new EvmAdapter({
      chainId: network.chainId,
      rpcUrl: network.rpcUrl,
      vaultAddress: network.vaultAddress,
      usdcAddress: network.usdcAddress,
      relayerPrivateKey: relayerKey as `0x${string}`,
    });

    const pollarAdapter = new PollarStellarAdapter({
      appId: pollarAppId,
      secretKey: process.env.POLLAR_SECRET_KEY,
      horizonUrl,
    });

    const orchestrator = new RelayerOrchestrator(evmAdapter, pollarAdapter);

    console.log(`\nInitial balances on ${network.name}:`);
    const vaultBalance = await evmAdapter.getVaultBalance();
    const aliceBalance = await evmAdapter.getAccountUsdcBalance(aliceAddress);
    const bobBalance = await evmAdapter.getAccountUsdcBalance(bobAddress);
    console.log(`  • Vault Liquidity:       ${formatUnits(vaultBalance, 6)} ${network.usdcLabel}`);
    console.log(`  • Alice (Buyer EVM):     ${formatUnits(aliceBalance, 6)} ${network.usdcLabel}`);
    console.log(`  • Bob (Merchant EVM):    ${formatUnits(bobBalance, 6)} ${network.usdcLabel}`);

    // =========================================================================
    // FLOW 1: STELLAR (Pollar) → EVM (Bob)
    // =========================================================================
    console.log("\n" + "-".repeat(70));
    console.log(`FLOW 1: STELLAR (Pollar SDK) → ${network.name} (Merchant EVM)`);
    console.log("-".repeat(70));
    console.log(`  • Payer:        Charlie on Stellar (${charlieStellar})`);
    console.log(`  • Recipient:    Bob on ${network.name} (${bobAddress})`);
    console.log(`  • Amount:       0.25 ${network.usdcLabel}`);

    if (vaultBalance >= parseUnits("0.25", 6)) {
      const paymentId1 = `0x${Buffer.from(`pay-s2e-${Date.now()}`).toString("hex").padEnd(64, "0")}` as `0x${string}`;

      console.log("\n  [1.1] On-chain Stellar Testnet registration via Pollar...");
      const stellarTx1 = await pollarAdapter.creditPayment(charlieStellar, parseUnits("0.25", 6), paymentId1);
      console.log(`     Tx Hash:     ${stellarTx1}`);
      if (isFabricatedStellarHash(stellarTx1)) {
        console.log("     WARNING: Friendbot/Horizon fallback hash — not a real Stellar ledger tx.");
      } else {
        console.log(`     Explorer:    https://stellar.expert/explorer/testnet/tx/${stellarTx1}`);
      }

      console.log(`\n  [1.2] Relayer calls releasePayment on ${network.name}...`);
      const evmTx1 = await orchestrator.handleStellarToEvm({
        referenceId: paymentId1,
        amount: parseUnits("0.25", 6),
        destinationEvmAddress: bobAddress,
      });
      console.log(`     Tx Hash:     ${evmTx1}`);
      console.log(`     ${network.explorerName}:   ${network.explorerTx(evmTx1)}`);

      await new Promise((r) => setTimeout(r, 2000));
      const bobFinal = await evmAdapter.getAccountUsdcBalance(bobAddress);
      console.log(
        `\n  Bob balance on ${network.name}: ${formatUnits(bobFinal, 6)} ${network.usdcLabel} (+0.25)`
      );
    } else {
      console.log("  Vault has insufficient liquidity for Flow 1.");
    }

    // =========================================================================
    // FLOW 2: EVM (Alice) → STELLAR (Charlie)
    // =========================================================================
    console.log("\n" + "-".repeat(70));
    console.log(`FLOW 2: ${network.name} (Payer EVM) → STELLAR (Pollar Recipient)`);
    console.log("-".repeat(70));
    console.log(`  • Payer:        Alice on ${network.name} (${aliceAddress})`);
    console.log(`  • Recipient:    Charlie on Stellar (${charlieStellar})`);
    console.log(`  • Amount:       0.10 ${network.usdcLabel}`);

    if (aliceBalance >= parseUnits("0.10", 6)) {
      const paymentId2 = `0x${Buffer.from(`pay-e2s-${Date.now()}`).toString("hex").padEnd(64, "0")}` as `0x${string}`;
      const encodedStellarRecipient = PollarStellarAdapter.stellarAddressToBytes32(charlieStellar);

      console.log(`\n  [2.1] Alice approves ${network.usdcLabel} and calls depositPayment...`);
      const aliceAccount = privateKeyToAccount(aliceKey);
      const aliceWallet = createWalletClient({
        account: aliceAccount,
        chain: network.chain,
        transport: http(network.rpcUrl),
      });

      const erc20Abi = parseAbi([
        "function approve(address spender, uint256 amount) returns (bool)",
        "function allowance(address owner, address spender) view returns (uint256)",
      ]);

      const approveHash = await aliceWallet.writeContract({
        address: network.usdcAddress,
        abi: erc20Abi,
        functionName: "approve",
        args: [network.vaultAddress, parseUnits("0.10", 6)],
      });
      console.log(`     Approve Tx:  ${approveHash}`);
      await evmAdapter.publicClient.waitForTransactionReceipt({ hash: approveHash });
      console.log(`     ${network.explorerName}:   ${network.explorerTx(approveHash)}`);

      const depositIntent: Omit<PaymentIntent, "status" | "createdAt"> = {
        paymentId: paymentId2,
        amount: parseUnits("0.10", 6),
        sourceDomain: network.domain,
        destinationDomain: CrossChainDomain.STELLAR,
        sourcePayer: aliceAddress,
        destinationRecipient: encodedStellarRecipient,
      };

      const depositHash = await aliceWallet.writeContract({
        address: network.vaultAddress,
        abi: parseAbi([
          "function depositPayment(bytes32 paymentId, uint256 amount, uint32 destinationDomain, bytes32 destinationRecipient, bytes calldata metadata) external",
        ]),
        functionName: "depositPayment",
        args: [
          depositIntent.paymentId,
          depositIntent.amount,
          depositIntent.destinationDomain,
          depositIntent.destinationRecipient as `0x${string}`,
          "0x",
        ],
      });
      console.log(`     Deposit Tx:  ${depositHash}`);
      await evmAdapter.publicClient.waitForTransactionReceipt({ hash: depositHash });
      console.log(`     ${network.explorerName}:   ${network.explorerTx(depositHash)}`);

      console.log("\n  [2.2] Relayer acknowledgePayment then credits Stellar via Pollar...");
      const fullIntent: PaymentIntent = {
        ...depositIntent,
        status: BridgePaymentStatus.PROCESSING,
        createdAt: new Date(),
        sourceTxHash: depositHash,
      };

      await orchestrator.handleEvmToStellar(fullIntent);
      const status2 = await orchestrator.getPaymentStatus(paymentId2);
      console.log(`     Tx Hash:     ${status2?.destinationTxHash}`);
      if (isFabricatedStellarHash(status2?.destinationTxHash)) {
        console.log("     WARNING: Friendbot/Horizon fallback hash — not a real Stellar ledger tx.");
      } else if (status2?.destinationTxHash) {
        console.log(
          `     Explorer:    https://stellar.expert/explorer/testnet/tx/${status2.destinationTxHash}`
        );
      }
    } else {
      console.log(`  Alice has insufficient ${network.usdcLabel} for Flow 2.`);
    }

    console.log("\n" + "=".repeat(70));
    console.log("   BOTH CROSS-CHAIN FLOWS FINISHED ON LIVE TESTNET");
    console.log("=".repeat(70) + "\n");
  } else {
    console.log("\nMode: LOCAL / SIMULATED SETTLEMENT");
    console.log("   Set EVM_VAULT_ADDRESS to run live against HashKey Chain Testnet & Stellar");
  }
}

main().catch((err) => {
  console.error("\nExecution error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
