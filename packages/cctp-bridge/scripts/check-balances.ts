import { createPublicClient, http, formatUnits, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia, avalancheFuji } from "viem/chains";
import * as dotenv from "dotenv";

dotenv.config();

const privateKey = process.env.RELAYER_PRIVATE_KEY || process.env.PRIVATE_KEY;
if (!privateKey) {
  console.error("No private key found in .env");
  process.exit(1);
}

const account = privateKeyToAccount(privateKey as `0x${string}`);
console.log(`\n========================================`);
console.log(`Wallet Address: ${account.address}`);
console.log(`========================================`);

const erc20Abi = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
]);

const ARBITRUM_SEPOLIA_USDC = "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d" as `0x${string}`;
const FUJI_USDC = "0x5425890298aed601595a70ab815c96711a31bc65" as `0x${string}`;

async function main() {
  // 1. Arbitrum Sepolia
  const arbClient = createPublicClient({
    chain: arbitrumSepolia,
    transport: http("https://sepolia-rollup.arbitrum.io/rpc"),
  });

  const [arbEth, arbUsdc] = await Promise.all([
    arbClient.getBalance({ address: account.address }),
    arbClient.readContract({
      address: ARBITRUM_SEPOLIA_USDC,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [account.address],
    }).catch(() => 0n),
  ]);

  console.log(`[Arbitrum Sepolia]`);
  console.log(`- ETH (Gas): ${formatUnits(arbEth, 18)} ETH`);
  console.log(`- Circle USDC: ${formatUnits(arbUsdc, 6)} USDC`);

  // 1b. Arbitrum One Mainnet
  const ARB_MAINNET_USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" as `0x${string}`;
  try {
    const arbMainnetClient = createPublicClient({
      transport: http("https://arb1.arbitrum.io/rpc"),
    });
    const [arbMainEth, arbMainUsdc] = await Promise.all([
      arbMainnetClient.getBalance({ address: account.address }),
      arbMainnetClient.readContract({
        address: ARB_MAINNET_USDC,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [account.address],
      }).catch(() => 0n),
    ]);
    console.log(`\n[Arbitrum One (Mainnet)]`);
    console.log(`- ETH (Gas): ${formatUnits(arbMainEth, 18)} ETH`);
    console.log(`- Circle USDC: ${formatUnits(arbMainUsdc, 6)} USDC`);
  } catch (err) {
    console.log(`\n[Arbitrum One Mainnet] Check error:`, err);
  }

  // 2. Avalanche Fuji
  const fujiClient = createPublicClient({
    chain: avalancheFuji,
    transport: http("https://api.avax-test.network/ext/bc/C/rpc"),
  });

  const [fujiAvax, fujiUsdc] = await Promise.all([
    fujiClient.getBalance({ address: account.address }),
    fujiClient.readContract({
      address: FUJI_USDC,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [account.address],
    }).catch(() => 0n),
  ]);

  console.log(`\n[Avalanche Fuji]`);
  console.log(`- AVAX (Gas): ${formatUnits(fujiAvax, 18)} AVAX`);
  console.log(`- Circle USDC: ${formatUnits(fujiUsdc, 6)} USDC`);
}

main().catch(console.error);
