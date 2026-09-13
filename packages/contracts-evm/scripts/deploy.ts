import { ethers, network } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: "../../.env" });

async function main() {
  const [deployer] = await ethers.getSigners();
  const chainId = (await ethers.provider.getNetwork()).chainId;
  console.log(`\n========================================`);
  console.log(`[Deploy] Network: ${network.name} (Chain ID: ${chainId})`);
  console.log(`[Deploy] Deployer / Admin: ${deployer.address}`);

  let usdcAddress = process.env.USDC_ADDRESS;

  if (network.name === "avaxFuji") {
    // Official Circle USDC on Avalanche Fuji
    usdcAddress = process.env.AVAX_USDC_ADDRESS || "0x5425890298aed601595a70ab815c96711a31bc65";
    console.log(`[Deploy] Using Circle USDC on Fuji: ${usdcAddress}`);
  } else if (network.name === "hskTestnet") {
    usdcAddress = process.env.HSK_USDC_ADDRESS;
  }

  let isMockUSDC = false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockUsdcContract: any = null;

  // If local or no address specified, deploy MockUSDC
  if (!usdcAddress || network.name === "hardhat" || network.name === "localhost") {
    console.log("[Deploy] Deploying MockUSDC for testing environment...");
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const mockUsdc = await MockUSDC.deploy();
    await mockUsdc.waitForDeployment();
    usdcAddress = await mockUsdc.getAddress();
    isMockUSDC = true;
    mockUsdcContract = mockUsdc;
    console.log(`[Deploy] MockUSDC deployed at: ${usdcAddress}`);
  }

  const relayerAddress =
    process.env.RELAYER_ADDRESS ||
    process.env.HSK_RELAYER_ADDRESS ||
    deployer.address;

  console.log(`[Deploy] Deploying ZIP0PaymentVault...`);
  console.log(`  - USDC Token: ${usdcAddress}`);
  console.log(`  - Admin: ${deployer.address}`);
  console.log(`  - Relayer: ${relayerAddress}`);

  const VaultFactory = await ethers.getContractFactory("ZIP0PaymentVault");
  const vault = await VaultFactory.deploy(usdcAddress, deployer.address, relayerAddress);
  await vault.waitForDeployment();

  const vaultAddress = await vault.getAddress();
  console.log(`[Deploy] ZIP0PaymentVault deployed at: ${vaultAddress}`);

  // Verify on-chain bytecode via eth_getCode
  const code = await ethers.provider.getCode(vaultAddress);
  if (code === "0x" || code === "") {
    throw new Error(`Deployment verification failed: No bytecode found at ${vaultAddress}`);
  }
  console.log(`[Verify] Verified runtime bytecode exists at ${vaultAddress} (${code.length / 2 - 1} bytes)`);

  // Verify RELAYER_ROLE
  const RELAYER_ROLE = await vault.RELAYER_ROLE();
  const hasRelayerRole = await vault.hasRole(RELAYER_ROLE, relayerAddress);
  console.log(`[Verify] Relayer ${relayerAddress} has RELAYER_ROLE: ${hasRelayerRole}`);

  // Seed liquidity if MockUSDC was deployed
  if (isMockUSDC && mockUsdcContract) {
    const seedAmount = ethers.parseUnits("50000", 6); // 50,000 MockUSDC
    console.log(`[Seed] Seeding vault with 50,000 MockUSDC for release liquidity...`);
    const seedTx = await mockUsdcContract.transfer(vaultAddress, seedAmount);
    await seedTx.wait();
    const vaultBal = await mockUsdcContract.balanceOf(vaultAddress);
    console.log(`[Seed] Vault MockUSDC balance: ${ethers.formatUnits(vaultBal, 6)} USDC`);
  }

  console.log(`\n========================================`);
  console.log(`ZIP0PaymentVault deployed successfully!`);
  console.log(`Contract Address: ${vaultAddress}`);
  console.log(`Network: ${network.name}`);
  console.log(`Verify Command:`);
  console.log(
    `pnpm --filter @zip-0/contracts-evm hardhat verify --network ${network.name} ${vaultAddress} "${usdcAddress}" "${deployer.address}" "${relayerAddress}"`
  );
  console.log(`========================================\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
