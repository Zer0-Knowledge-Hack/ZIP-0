import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPublicClient,
  createWalletClient,
  http,
  type Account,
  type Address,
  type Chain,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hardhatLocal } from "../../src/adapters/evm/client.js";

/** Documented Hardhat/Anvil Account #0 — local development only. */
export const HARDHAT_ACCOUNT_0 = {
  address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as Address,
  privateKey:
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as Hex,
};

/** Documented Hardhat/Anvil Account #1 — local development only. */
export const HARDHAT_ACCOUNT_1 = {
  address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as Address,
};

const MOCK_USDC_ABI = [
  { type: "constructor", inputs: [], stateMutability: "nonpayable" },
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable",
  },
] as const;

const VAULT_DEPLOY_ABI = [
  {
    type: "constructor",
    inputs: [
      { name: "_usdcToken", type: "address" },
      { name: "admin", type: "address" },
      { name: "initialRelayer", type: "address" },
    ],
    stateMutability: "nonpayable",
  },
] as const;

const helpersDir = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(helpersDir, "../../../..");

export interface LocalHardhatHandle {
  port: number;
  rpcUrl: string;
  chain: Chain;
  account: Account;
  process: ChildProcess;
}

export interface DeployedLocalContracts {
  usdcAddress: Address;
  vaultAddress: Address;
}

export function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Could not allocate a local TCP port"));
        return;
      }
      const { port } = address;
      server.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
}

export async function startHardhatNode(): Promise<LocalHardhatHandle> {
  const port = await getFreePort();
  const rpcUrl = `http://127.0.0.1:${port}`;
  const child = spawn(
    "pnpm",
    [
      "--filter",
      "@zip-0/contracts-evm",
      "exec",
      "hardhat",
      "node",
      "--port",
      String(port),
      "--hostname",
      "127.0.0.1",
    ],
    {
      cwd: REPO_ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
      windowsHide: true,
    }
  );

  const logs: string[] = [];
  child.stdout?.on("data", (chunk: Buffer) => {
    logs.push(chunk.toString());
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    logs.push(chunk.toString());
  });

  child.once("exit", (code) => {
    if (code && code !== 0) {
      logs.push(`hardhat node exited with code ${code}`);
    }
  });

  try {
    await waitForRpc(rpcUrl, 90_000);
  } catch (err) {
    await stopHardhatNode(child);
    const detail = logs.join("").slice(-2_000);
    throw new Error(
      `Hardhat node did not become ready on ${rpcUrl}. ${
        err instanceof Error ? err.message : String(err)
      }${detail ? `\n${detail}` : ""}`
    );
  }

  const account = privateKeyToAccount(HARDHAT_ACCOUNT_0.privateKey);
  const chain = { ...hardhatLocal, rpcUrls: { default: { http: [rpcUrl] } } };

  return { port, rpcUrl, chain, account, process: child };
}

export async function stopHardhatNode(child: ChildProcess): Promise<void> {
  if (!child.pid || child.exitCode !== null) {
    return;
  }

  if (process.platform === "win32") {
    await new Promise<void>((resolve) => {
      const killer = spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
        stdio: "ignore",
        windowsHide: true,
      });
      killer.once("exit", () => resolve());
      killer.once("error", () => {
        child.kill();
        resolve();
      });
    });
    return;
  }

  child.kill("SIGTERM");
}

export async function deployLocalVault(handle: LocalHardhatHandle): Promise<DeployedLocalContracts> {
  const walletClient = createWalletClient({
    account: handle.account,
    chain: handle.chain,
    transport: http(handle.rpcUrl),
  });
  const publicClient = createPublicClient({
    chain: handle.chain,
    transport: http(handle.rpcUrl),
  });

  const mockUsdcHash = await walletClient.deployContract({
    abi: MOCK_USDC_ABI,
    bytecode: readTypechainBytecode(
      "typechain-types/factories/contracts/test/MockUSDC__factory.ts"
    ),
    account: handle.account,
    chain: handle.chain,
  });
  const mockUsdcReceipt = await publicClient.waitForTransactionReceipt({ hash: mockUsdcHash });
  if (!mockUsdcReceipt.contractAddress) {
    throw new Error("MockUSDC deploy did not return a contract address");
  }

  const vaultHash = await walletClient.deployContract({
    abi: VAULT_DEPLOY_ABI,
    bytecode: readTypechainBytecode(
      "typechain-types/factories/contracts/ZIP0PaymentVault__factory.ts"
    ),
    args: [mockUsdcReceipt.contractAddress, handle.account.address, handle.account.address],
    account: handle.account,
    chain: handle.chain,
  });
  const vaultReceipt = await publicClient.waitForTransactionReceipt({ hash: vaultHash });
  if (!vaultReceipt.contractAddress) {
    throw new Error("ZIP0PaymentVault deploy did not return a contract address");
  }

  return {
    usdcAddress: mockUsdcReceipt.contractAddress,
    vaultAddress: vaultReceipt.contractAddress,
  };
}

export async function approveUsdc(
  handle: LocalHardhatHandle,
  usdcAddress: Address,
  spender: Address,
  amount: bigint
): Promise<void> {
  const walletClient = createWalletClient({
    account: handle.account,
    chain: handle.chain,
    transport: http(handle.rpcUrl),
  });
  const publicClient = createPublicClient({
    chain: handle.chain,
    transport: http(handle.rpcUrl),
  });

  const hash = await walletClient.writeContract({
    address: usdcAddress,
    abi: MOCK_USDC_ABI,
    functionName: "approve",
    args: [spender, amount],
    account: handle.account,
    chain: handle.chain,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error("USDC approve transaction failed");
  }
}

function readTypechainBytecode(relativeFactory: string): Hex {
  let factoryPath = path.join(REPO_ROOT, "packages/contracts-evm", relativeFactory);
  if (!existsSync(factoryPath)) {
    const dirname = path.dirname(relativeFactory);
    const basename = path.basename(relativeFactory);
    const solName = basename.replace(/__factory\.ts$/, ".sol");
    const altPath = path.join(REPO_ROOT, "packages/contracts-evm", dirname, solName, basename);
    if (existsSync(altPath)) {
      factoryPath = altPath;
    }
  }
  const source = readFileSync(factoryPath, "utf8");
  const match = source.match(/const _bytecode\s*=\s*"(0x[0-9a-fA-F]+)"/);

  if (!match) {
    throw new Error(`Could not extract bytecode from ${factoryPath}`);
  }

  return match[1] as Hex;
}

async function waitForRpc(rpcUrl: string, timeoutMs: number): Promise<void> {
  const client = createPublicClient({
    chain: hardhatLocal,
    transport: http(rpcUrl),
  });
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    try {
      const chainId = await client.getChainId();
      if (chainId === 31337) {
        return;
      }
    } catch {
      // Node is still booting.
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  throw new Error(`Timed out waiting for JSON-RPC at ${rpcUrl}`);
}
