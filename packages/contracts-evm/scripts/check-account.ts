import { ethers, network } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`[Account] Network: ${network.name}`);
  console.log(`[Account] Address: ${deployer.address}`);
  console.log(`[Account] Balance: ${ethers.formatEther(balance)} native tokens`);
}

main().catch(console.error);
