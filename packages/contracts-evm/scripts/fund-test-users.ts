import { ethers, network } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: "../../.env" });

import * as fs from "fs";
import * as path from "path";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let testWallets: any = null;
const walletsPath = path.resolve(__dirname, "../wallets/test-wallets.json");
if (fs.existsSync(walletsPath)) {
  try {
    testWallets = JSON.parse(fs.readFileSync(walletsPath, "utf-8"));
  } catch {
    // ignore
  }
}

const aliceAddress =
  process.env.ALICE_ADDRESS ||
  testWallets?.evm?.users?.alice?.address;

const bobAddress =
  process.env.BOB_ADDRESS ||
  testWallets?.evm?.users?.bob?.address;

if (!aliceAddress || !bobAddress) {
  throw new Error(
    "Missing test user addresses. Configure ALICE_ADDRESS and BOB_ADDRESS in .env or provide wallets/test-wallets.json"
  );
}

const TEST_USERS = [
  {
    name: "Test User 1 (Alice - Buyer)",
    address: aliceAddress,
  },
  {
    name: "Test User 2 (Bob - Merchant)",
    address: bobAddress,
  },
];

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("\n========================================================");
  console.log(`[Fund Test Users] Network: ${network.name}`);
  console.log(`[Fund Test Users] Deployer / Funder: ${deployer.address}`);

  const deployerNative = await ethers.provider.getBalance(deployer.address);
  console.log(`  • Deployer AVAX Balance: ${ethers.formatEther(deployerNative)} AVAX`);

  const usdcAddress =
    process.env.AVAX_USDC_ADDRESS ||
    process.env.USDC_ADDRESS ||
    "0x5425890298aed601595a70ab815c96711a31bc65";

  const usdc = new ethers.Contract(usdcAddress, ERC20_ABI, deployer);
  const deployerUsdc = await usdc.balanceOf(deployer.address);
  console.log(`  • Deployer USDC Balance: ${ethers.formatUnits(deployerUsdc, 6)} USDC (${usdcAddress})`);
  console.log("========================================================\n");

  const avaxFundingAmount = ethers.parseEther("0.1"); // 0.1 AVAX
  const usdcFundingAmount = ethers.parseUnits("1.5", 6); // 1.50 USDC

  for (const user of TEST_USERS) {
    console.log(`Funding ${user.name} (${user.address})...`);

    // 1. Check & fund AVAX (gas)
    const userAvax = await ethers.provider.getBalance(user.address);
    console.log(`  • Current AVAX: ${ethers.formatEther(userAvax)} AVAX`);
    if (userAvax < ethers.parseEther("0.05")) {
      console.log(`  👉 Sending 0.1 AVAX for gas...`);
      const tx = await deployer.sendTransaction({
        to: user.address,
        value: avaxFundingAmount,
      });
      console.log(`     Tx Hash: ${tx.hash}`);
      await tx.wait();
      console.log(`     Confirmed!`);
    } else {
      console.log(`  ✓ Already has sufficient AVAX for gas.`);
    }

    // 2. Check & fund USDC
    const userUsdc = await usdc.balanceOf(user.address);
    console.log(`  • Current USDC: ${ethers.formatUnits(userUsdc, 6)} USDC`);
    if (userUsdc < ethers.parseUnits("1.0", 6)) {
      console.log(`  👉 Sending 1.50 USDC...`);
      const tx = await usdc.transfer(user.address, usdcFundingAmount);
      console.log(`     Tx Hash: ${tx.hash}`);
      await tx.wait();
      console.log(`     Confirmed!`);
    } else {
      console.log(`  ✓ Already has sufficient USDC.`);
    }

    const finalAvax = await ethers.provider.getBalance(user.address);
    const finalUsdc = await usdc.balanceOf(user.address);
    console.log(`  ✅ Final Balances: ${ethers.formatEther(finalAvax)} AVAX | ${ethers.formatUnits(finalUsdc, 6)} USDC\n`);
  }

  console.log("========================================================");
  console.log("All test users successfully funded and ready to use!");
  console.log("========================================================\n");
}

main().catch((error) => {
  console.error("Funding error:", error);
  process.exitCode = 1;
});
