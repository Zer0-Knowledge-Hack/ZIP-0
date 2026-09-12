import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";
import { createWalletClient, formatUnits, http, parseAbi, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { avalancheFuji } from "viem/chains";
import { EvmAdapter } from "../src/adapters/evm/client.js";
import { PollarStellarAdapter } from "../src/adapters/pollar/client.js";
import { RelayerOrchestrator } from "../src/relayer/orchestrator.js";
import { CrossChainDomain, PaymentIntent, BridgePaymentStatus } from "../src/core/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../contracts-evm/.env") });

// Read test-wallets.json if present
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

async function main() {
  console.log("\n" + "=".repeat(70));
  console.log("   🚀 ZIP-0 PAYMENT BRIDGE — BIDIRECTIONAL CROSS-CHAIN RUNNER");
  console.log("   Stellar (Pollar SDK) ⇄ Multi-EVM Settlement (Avalanche Fuji)");
  console.log("=".repeat(70) + "\n");

  const pollarAppId = process.env.POLLAR_APP_ID || "cmty35mez000v0iobxbgcitxt";
  const horizonUrl = process.env.STELLAR_HORIZON_URL || "https://horizon-testnet.stellar.org";
  const evmChainId = parseInt(process.env.EVM_CHAIN_ID || "43113", 10);
  const evmRpcUrl = process.env.EVM_RPC_URL || "https://api.avax-test.network/ext/bc/C/rpc";
  const vaultAddress = (process.env.EVM_VAULT_ADDRESS || "0xF1ca5572DC03f84aB0f2e5806df336264375e1Fa").trim();
  const usdcAddress = (process.env.EVM_USDC_ADDRESS || "0x5425890298aed601595a70ab815c96711a31bc65").trim();
  const relayerKey = requireSecret("relayer private key", [
    "RELAYER_PRIVATE_KEY",
    "PRIVATE_KEY",
  ]);

  const relayerAccount = privateKeyToAccount(relayerKey as `0x${string}`);

  // Test accounts
  const aliceAddress = (testWallets?.evm?.users?.alice?.address || "0x8dF4b3F59DF5B67E7372B1e74Ad952cB2da7d246") as `0x${string}`;
  const aliceKey = requireSecret(
    "test payer (alice) private key",
    ["ALICE_PRIVATE_KEY"],
    testWallets?.evm?.users?.alice?.privateKey
  );
  const bobAddress = (testWallets?.evm?.users?.bob?.address || "0x503a41a175e599F62353790D1B958d1c296C38ef") as `0x${string}`;
  const charlieStellar = (testWallets?.stellar?.users?.charlie?.publicKey || "GDS232ENS4F7DZHDN6OYNECGX2ZXZ4JAWMXFPQDUH5P4DR6NRBR4J2VS");

  console.log("📋 Configuration Overview:");
  console.log(`  • Stellar Network:    Testnet (${horizonUrl})`);
  console.log(`  • Pollar App ID:      ${pollarAppId}`);
  console.log(`  • EVM Network:        Avalanche Fuji Testnet (${evmChainId})`);
  console.log(`  • EVM RPC:            ${evmRpcUrl}`);
  console.log(`  • Circle USDC (EVM):  ${usdcAddress}`);
  console.log(`  • ZIP0PaymentVault:   ${vaultAddress}`);
  console.log(`  • Relayer Wallet:     ${relayerAccount.address}`);
  console.log(`  • Test User (Alice):  ${aliceAddress} (EVM Buyer)`);
  console.log(`  • Test User (Bob):    ${bobAddress} (EVM Merchant)`);
  console.log(`  • Test User (Charlie):${charlieStellar} (Stellar Pollar Customer)`);
  console.log("-".repeat(70));

  const isLiveTestnet = Boolean(vaultAddress && vaultAddress.startsWith("0x") && vaultAddress.length === 42);

  if (isLiveTestnet) {
    console.log("\n🌐 Mode: LIVE CROSS-CHAIN TESTNET (Stellar Testnet ⇄ Avalanche Fuji)");

    const evmAdapter = new EvmAdapter({
      chainId: evmChainId,
      rpcUrl: evmRpcUrl,
      vaultAddress: vaultAddress as `0x${string}`,
      usdcAddress: usdcAddress as `0x${string}`,
      relayerPrivateKey: relayerKey as `0x${string}`,
    });

    const pollarAdapter = new PollarStellarAdapter({
      appId: pollarAppId,
      secretKey: process.env.POLLAR_SECRET_KEY,
      horizonUrl,
    });

    const orchestrator = new RelayerOrchestrator(evmAdapter, pollarAdapter);

    console.log("\n🔍 Balances Iniciales en Avalanche Fuji:");
    const vaultBalance = await evmAdapter.getVaultBalance();
    const aliceBalance = await evmAdapter.getAccountUsdcBalance(aliceAddress);
    const bobBalance = await evmAdapter.getAccountUsdcBalance(bobAddress);
    console.log(`  • Vault Liquidity:       ${formatUnits(vaultBalance, 6)} USDC`);
    console.log(`  • Alice (Buyer EVM):     ${formatUnits(aliceBalance, 6)} USDC`);
    console.log(`  • Bob (Merchant EVM):    ${formatUnits(bobBalance, 6)} USDC`);

    // =========================================================================
    // FLUJO 1: STELLAR (Pollar) ➔ AVALANCHE FUJI (Bob)
    // =========================================================================
    console.log("\n" + "-".repeat(70));
    console.log("➡️  FLUJO 1: STELLAR (Pollar SDK) ➔ AVALANCHE FUJI (Merchant EVM)");
    console.log("-".repeat(70));
    console.log(`  • Payer:       Charlie en Stellar (${charlieStellar})`);
    console.log(`  • Destinatario:Bob en Avalanche Fuji (${bobAddress})`);
    console.log(`  • Monto:       0.25 USDC`);

    if (vaultBalance >= parseUnits("0.25", 6)) {
      const paymentId1 = `0x${Buffer.from(`pay-s2e-${Date.now()}`).toString("hex").padEnd(64, "0")}` as `0x${string}`;

      console.log("\n  [1.1] Transacción on-chain en Stellar Testnet vía Pollar...");
      const stellarTx1 = await pollarAdapter.creditPayment(charlieStellar, parseUnits("0.25", 6), paymentId1);
      console.log(`  ✅ Confirmado en Stellar Ledger!`);
      console.log(`     Tx Hash:     ${stellarTx1}`);
      console.log(`     Explorer:    https://stellar.expert/explorer/testnet/tx/${stellarTx1}`);

      console.log("\n  [1.2] Relayer intercepta cobro y ejecuta releasePayment en Avalanche Fuji...");
      const evmTx1 = await orchestrator.handleStellarToEvm({
        referenceId: paymentId1,
        amount: parseUnits("0.25", 6),
        destinationEvmAddress: bobAddress,
      });
      console.log(`  ✅ Liquidación exitosa en Avalanche Fuji!`);
      console.log(`     Tx Hash:     ${evmTx1}`);
      console.log(`     SnowTrace:   https://testnet.snowtrace.io/tx/${evmTx1}`);

      await new Promise((r) => setTimeout(r, 2000));
      const bobFinal = await evmAdapter.getAccountUsdcBalance(bobAddress);
      console.log(`\n  📊 Saldo Bob en Avalanche: ${formatUnits(bobFinal, 6)} USDC (+0.25 USDC)`);
    } else {
      console.log("  ⚠️ Vault sin liquidez suficiente para liquidar Flujo 1.");
    }

    // =========================================================================
    // FLUJO 2: AVALANCHE FUJI (Alice) ➔ STELLAR (Charlie)
    // =========================================================================
    console.log("\n" + "-".repeat(70));
    console.log("➡️  FLUJO 2: AVALANCHE FUJI (Payer EVM) ➔ STELLAR (Pollar Recipient)");
    console.log("-".repeat(70));
    console.log(`  • Payer:       Alice en Avalanche Fuji (${aliceAddress})`);
    console.log(`  • Destinatario:Charlie en Stellar (${charlieStellar})`);
    console.log(`  • Monto:       0.10 USDC`);

    if (aliceBalance >= parseUnits("0.10", 6)) {
      const paymentId2 = `0x${Buffer.from(`pay-e2s-${Date.now()}`).toString("hex").padEnd(64, "0")}` as `0x${string}`;
      const encodedStellarRecipient = PollarStellarAdapter.stellarAddressToBytes32(charlieStellar);

      console.log("\n  [2.1] Alice aprueba USDC y llama a depositPayment(...) en el Vault de Fuji...");
      const aliceAccount = privateKeyToAccount(aliceKey);
      const aliceWallet = createWalletClient({
        account: aliceAccount,
        chain: avalancheFuji,
        transport: http(evmRpcUrl),
      });

      const erc20Abi = parseAbi([
        "function approve(address spender, uint256 amount) returns (bool)",
        "function allowance(address owner, address spender) view returns (uint256)",
      ]);

      // Approve Vault
      const approveHash = await aliceWallet.writeContract({
        address: usdcAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: "approve",
        args: [vaultAddress as `0x${string}`, parseUnits("0.10", 6)],
      });
      console.log(`     Approve Tx:  ${approveHash}`);
      await evmAdapter.publicClient.waitForTransactionReceipt({ hash: approveHash });
      console.log(`     Approve confirmado en bloque de Fuji!`);

      // Deposit
      const depositIntent: Omit<PaymentIntent, "status" | "createdAt"> = {
        paymentId: paymentId2,
        amount: parseUnits("0.10", 6),
        sourceDomain: CrossChainDomain.AVALANCHE,
        destinationDomain: CrossChainDomain.STELLAR,
        sourcePayer: aliceAddress,
        destinationRecipient: encodedStellarRecipient,
      };

      const depositHash = await aliceWallet.writeContract({
        address: vaultAddress as `0x${string}`,
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
      console.log(`  ✅ Depósito confirmado en bloque de Avalanche Fuji!`);
      console.log(`     SnowTrace:   https://testnet.snowtrace.io/tx/${depositHash}`);

      console.log("\n  [2.2] Relayer detecta el depósito y acredita fondos en Stellar vía Pollar...");
      const fullIntent: PaymentIntent = {
        ...depositIntent,
        status: BridgePaymentStatus.PROCESSING,
        createdAt: new Date(),
        sourceTxHash: depositHash,
      };

      await orchestrator.handleEvmToStellar(fullIntent);
      const status2 = await orchestrator.getPaymentStatus(paymentId2);
      console.log(`  ✅ Liquidación confirmada en Stellar!`);
      console.log(`     Tx Hash:     ${status2?.destinationTxHash}`);
      console.log(`     Explorer:    https://stellar.expert/explorer/testnet/tx/${status2?.destinationTxHash}`);
    } else {
      console.log("  ⚠️ Alice sin balance USDC suficiente para Flujo 2.");
    }

    console.log("\n" + "=".repeat(70));
    console.log("   🎉 ¡AMBOS FLUJOS CROSS-CHAIN COMPLETADOS EN TESTNET EN VIVO!");
    console.log("=".repeat(70) + "\n");
  } else {
    console.log("\n🧪 Mode: LOCAL / SIMULATED SETTLEMENT");
    console.log("   (Configure EVM_VAULT_ADDRESS to run live against Avalanche Fuji & Stellar)");
  }
}

main().catch((err) => {
  console.error("\n❌ Execution error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
