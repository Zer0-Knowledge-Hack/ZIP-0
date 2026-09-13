import { ethers, network } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: "../../.env" });

/** Networks where a deployment moves real value. Mistakes here cost money. */
const PRODUCTION_NETWORKS = new Set(["hskMainnet"]);

/**
 * Key committed to this public repository before #18 and therefore permanently compromised.
 * It still holds RELAYER_ROLE on earlier deployments; it must never receive the role again.
 */
const COMPROMISED_RELAYER = "0xAB659E7197bB3c399E9a295261F1D4557D4A714B".toLowerCase();

async function main() {
  const [deployer] = await ethers.getSigners();
  const chainId = (await ethers.provider.getNetwork()).chainId;
  const isProduction = PRODUCTION_NETWORKS.has(network.name);
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
  } else if (network.name === "hskMainnet") {
    // Bridged USDC.e on HashKey Chain mainnet: 6 decimals, implements EIP-2612 permit
    // and ERC-3009 transferWithAuthorization. See docs/hsk-chain-integration.md.
    usdcAddress =
      process.env.HSK_MAINNET_USDC_ADDRESS || "0x054ed45810DbBAb8B27668922D110669c9D88D0a";
    console.log(`[Deploy] Using bridged USDC.e on HSK mainnet: ${usdcAddress}`);
  }

  let isMockUSDC = false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockUsdcContract: any = null;

  // A production vault wired to the wrong token is worse than no deployment: it burns real gas
  // to publish something unusable. Validate the token before spending anything.
  if (isProduction) {
    if (!usdcAddress) {
      throw new Error(
        `Refusing to deploy on ${network.name}: no USDC address resolved. Deploying MockUSDC on a ` +
          `production network would point the vault at a worthless token. Set HSK_MAINNET_USDC_ADDRESS.`
      );
    }

    const tokenCode = await ethers.provider.getCode(usdcAddress);
    if (tokenCode === "0x" || tokenCode === "") {
      throw new Error(
        `Refusing to deploy on ${network.name}: no contract found at ${usdcAddress}. ` +
          `Check the address is correct for this chain.`
      );
    }

    // A real USDC reports 6 decimals. Catches a token address copied from the wrong chain.
    const token = await ethers.getContractAt("MockUSDC", usdcAddress);
    const decimals = await token.decimals();
    if (Number(decimals) !== 6) {
      throw new Error(
        `Refusing to deploy on ${network.name}: token at ${usdcAddress} reports ${decimals} ` +
          `decimals, expected 6. The vault assumes 6-decimal USDC.`
      );
    }
    console.log(`[Verify] Token at ${usdcAddress} is a contract reporting 6 decimals.`);
  }

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

  if (isProduction && relayerAddress.toLowerCase() === COMPROMISED_RELAYER) {
    throw new Error(
      `Refusing to grant RELAYER_ROLE to ${relayerAddress}: this key was committed to a public ` +
        `repository and anyone holding it could drain vault float. Generate a fresh key and set ` +
        `RELAYER_ADDRESS. See SECURITY.md.`
    );
  }

  if (isProduction && deployer.address.toLowerCase() === COMPROMISED_RELAYER) {
    throw new Error(
      `Refusing to deploy from ${deployer.address}: this key is publicly known. See SECURITY.md.`
    );
  }

  if (relayerAddress.toLowerCase() === COMPROMISED_RELAYER) {
    console.warn(
      `[Warn] Testnet deployment using known signer address ${relayerAddress} for testing purposes. ` +
        `Production networks strictly forbid this key.`
    );
  }

  if (isProduction && relayerAddress === deployer.address) {
    console.warn(
      `[Warn] Relayer defaults to the deployer on a production network. The relayer key is used ` +
        `continuously and is far more exposed than an admin key — consider setting RELAYER_ADDRESS ` +
        `to a separate address.`
    );
  }

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
