import { BridgeKit } from "@circle-fin/bridge-kit";
import { createViemAdapterFromPrivateKey } from "@circle-fin/adapter-viem-v2";
import { inspect } from "util";
import * as dotenv from "dotenv";

dotenv.config();

const privateKey = (process.env.RELAYER_PRIVATE_KEY || process.env.PRIVATE_KEY) as `0x${string}`;
if (!privateKey || !privateKey.startsWith("0x")) {
  console.error("Error: RELAYER_PRIVATE_KEY must be set in .env");
  process.exit(1);
}

async function runBridge(
  fromChain: string = "Avalanche_Fuji",
  toChain: string = "Arbitrum_Sepolia",
  amount: string = "1.00"
) {
  const kit = new BridgeKit();
  const adapter = createViemAdapterFromPrivateKey({ privateKey });

  console.log("\n=======================================================");
  console.log(`[ZIP-0 CCTP Live Bridge] ${fromChain} ➔ ${toChain}`);
  console.log(`Amount: ${amount} USDC`);
  console.log("=======================================================\n");

  kit.on("bridge.approve", (p: any) => {
    console.log(`✓ Step 1/4 - USDC Approved on ${fromChain}:`, p.values.txHash);
  });

  kit.on("bridge.burn", (p: any) => {
    console.log(`✓ Step 2/4 - USDC Burned on ${fromChain}:`, p.values.txHash);
  });

  kit.on("bridge.fetchAttestation", (p: any) => {
    console.log(`⏳ Step 3/4 - Circle Iris Attestation State: ${p.values.state}`);
  });

  kit.on("bridge.mint", (p: any) => {
    console.log(`✓ Step 4/4 - USDC Minted on ${toChain}:`, p.values.txHash);
  });

  try {
    const result = await kit.bridge({
      from: { adapter, chain: fromChain },
      to: {
        adapter,
        chain: toChain,
      },
      amount,
    });

    console.log("\n🎉 Bridge CCTP Exitoso!");
    console.log(inspect(result, false, null, true));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("\n❌ Error en Bridge CCTP:", msg);
  }
}

// Read CLI args or use default Fuji -> Arbitrum Sepolia
const args = process.argv.slice(2);
const from = args[0] || "Avalanche_Fuji";
const to = args[1] || "Arbitrum_Sepolia";
const amt = args[2] || "1.00";

runBridge(from, to, amt).catch(console.error);
