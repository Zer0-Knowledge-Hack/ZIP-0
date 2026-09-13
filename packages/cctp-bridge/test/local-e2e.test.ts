import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseAbi, parseEventLogs } from "viem";
import { Keypair } from "@stellar/stellar-sdk";
import { EvmAdapter } from "../src/adapters/evm/client.js";
import { IStellarAdapter } from "../src/core/interfaces.js";
import { BridgePaymentStatus, CrossChainDomain, PaymentIntent } from "../src/core/types.js";
import { RelayerOrchestrator } from "../src/relayer/orchestrator.js";
import { PollarStellarAdapter } from "../src/adapters/pollar/client.js";
import {
  HARDHAT_ACCOUNT_0,
  HARDHAT_ACCOUNT_1,
  approveUsdc,
  deployLocalVault,
  startHardhatNode,
  stopHardhatNode,
  type LocalHardhatHandle,
} from "./helpers/local-hardhat.js";

describe("Local Node E2E Integration (Vitest)", () => {
  it("should process an end-to-end local payment cycle from HSK to Stellar", async () => {
    let releasedPaymentId: string | null = null;
    let releasedAmount: bigint = 0n;

    // In-memory simulation of local Hardhat node contract
    const mockLocalVault: IEvmAdapter = {
      depositPayment: async (_intent) => "0xlocaldeposittxhash" as `0x${string}`,
      releasePayment: async (paymentId, _recipient, amount) => {
        releasedPaymentId = paymentId;
        releasedAmount = amount;
        return "0xlocalreleasetxhash" as `0x${string}`;
      },
      acknowledgePayment: async (_paymentId) => "0xlocalacktxhash" as `0x${string}`,
      getVaultBalance: async () => 10_000n * 1_000_000n, // 10,000 MockUSDC in local vault
      onPaymentInitiated: (_cb) => () => {},
    };
const PAYMENT_INITIATED_EVENT = parseAbi([
  "event PaymentInitiated(bytes32 indexed paymentId, address indexed payer, uint256 amount, uint32 destinationDomain, bytes32 destinationRecipient, bytes metadata)",
]);
const PAYMENT_RELEASED_EVENT = parseAbi([
  "event PaymentReleased(bytes32 indexed paymentId, address indexed recipient, uint256 amount, address relayer)",
]);

const DEPOSIT_PAYMENT_ID =
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const RELEASE_PAYMENT_ID =
  "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as const;
const DEPOSIT_AMOUNT = 100n * 1_000_000n;
const RELEASE_AMOUNT = 50n * 1_000_000n;

function isRealTxHash(hash: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(hash);
}

describe("Local Hardhat integration (real EVM, mocked Stellar)", () => {
  let hardhat: LocalHardhatHandle;
  let evmAdapter: EvmAdapter;
  let orchestrator: RelayerOrchestrator;
  let stellarRecipient: string;
  let encodedRecipient: `0x${string}`;

  const mockStellar: IStellarAdapter = {
    creditPayment: async (_recipient, _amount, referenceId) => `stellar-tx-${referenceId}`,
    onPaymentReceived: () => () => {},
    getBalance: async () => 0n,
  };

  beforeAll(async () => {
    hardhat = await startHardhatNode();
    const deployed = await deployLocalVault(hardhat);
    await approveUsdc(hardhat, deployed.usdcAddress, deployed.vaultAddress, DEPOSIT_AMOUNT);

    evmAdapter = new EvmAdapter({
      rpcUrl: hardhat.rpcUrl,
      chainId: 31337,
      vaultAddress: deployed.vaultAddress,
      usdcAddress: deployed.usdcAddress,
      relayerPrivateKey: HARDHAT_ACCOUNT_0.privateKey,
    });

    orchestrator = new RelayerOrchestrator(evmAdapter, mockStellar);
    stellarRecipient = Keypair.random().publicKey();
    encodedRecipient = PollarStellarAdapter.stellarAddressToBytes32(stellarRecipient);
  }, 120_000);

  afterAll(async () => {
    if (hardhat) {
      await stopHardhatNode(hardhat.process);
    }
  });

  it("deposits and releases through the real EvmAdapter against a local chain", async () => {
    const vaultBeforeDeposit = await evmAdapter.getVaultBalance();
    expect(vaultBeforeDeposit).toBe(0n);

    const depositIntent: Omit<PaymentIntent, "status" | "createdAt"> = {
      paymentId: DEPOSIT_PAYMENT_ID,
      amount: DEPOSIT_AMOUNT,
      sourceDomain: CrossChainDomain.HASHKEY_CHAIN,
      destinationDomain: CrossChainDomain.STELLAR,
      sourcePayer: HARDHAT_ACCOUNT_0.address,
      destinationRecipient: encodedRecipient,
    };

    const depositHash = await evmAdapter.depositPayment(depositIntent);
    expect(isRealTxHash(depositHash)).toBe(true);
    expect(depositHash).not.toBe("0xlocaldeposittxhash");

    const depositReceipt = await evmAdapter.publicClient.getTransactionReceipt({
      hash: depositHash,
    });
    expect(depositReceipt.status).toBe("success");

    const initiated = parseEventLogs({
      abi: PAYMENT_INITIATED_EVENT,
      logs: depositReceipt.logs,
    });
    expect(initiated).toHaveLength(1);
    expect(initiated[0]?.args.paymentId).toBe(DEPOSIT_PAYMENT_ID);
    expect(initiated[0]?.args.payer.toLowerCase()).toBe(HARDHAT_ACCOUNT_0.address.toLowerCase());
    expect(initiated[0]?.args.amount).toBe(DEPOSIT_AMOUNT);
    expect(initiated[0]?.args.destinationDomain).toBe(CrossChainDomain.STELLAR);
    expect(initiated[0]?.args.destinationRecipient).toBe(encodedRecipient);

    const vaultAfterDeposit = await evmAdapter.getVaultBalance();
    expect(vaultAfterDeposit - vaultBeforeDeposit).toBe(DEPOSIT_AMOUNT);

    const fullIntent: PaymentIntent = {
      ...depositIntent,
      status: BridgePaymentStatus.PENDING,
      createdAt: new Date(),
      sourceTxHash: depositHash,
    };
    await orchestrator.handleHskToStellar(fullIntent);

    const status = await orchestrator.getPaymentStatus(DEPOSIT_PAYMENT_ID);
    expect(status?.status).toBe(BridgePaymentStatus.COMPLETED);
    expect(status?.destinationTxHash).toBe(`stellar-tx-${DEPOSIT_PAYMENT_ID}`);

    const recipientBeforeRelease = await evmAdapter.getAccountUsdcBalance(
      HARDHAT_ACCOUNT_1.address
    );

    const releaseHash = await orchestrator.handleStellarToHsk({
      referenceId: RELEASE_PAYMENT_ID,
      amount: RELEASE_AMOUNT,
      destinationHskAddress: HARDHAT_ACCOUNT_1.address,
    });
    expect(isRealTxHash(releaseHash)).toBe(true);
    expect(releaseHash).not.toBe("0xlocalreleasetxhash");

    const releaseReceipt = await evmAdapter.publicClient.getTransactionReceipt({
      hash: releaseHash,
    });
    expect(releaseReceipt.status).toBe("success");

    const released = parseEventLogs({
      abi: PAYMENT_RELEASED_EVENT,
      logs: releaseReceipt.logs,
    });
    expect(released).toHaveLength(1);
    expect(released[0]?.args.paymentId).toBe(RELEASE_PAYMENT_ID);
    expect(released[0]?.args.recipient.toLowerCase()).toBe(
      HARDHAT_ACCOUNT_1.address.toLowerCase()
    );
    expect(released[0]?.args.amount).toBe(RELEASE_AMOUNT);
    expect(released[0]?.args.relayer.toLowerCase()).toBe(HARDHAT_ACCOUNT_0.address.toLowerCase());

    const vaultAfterRelease = await evmAdapter.getVaultBalance();
    const recipientAfterRelease = await evmAdapter.getAccountUsdcBalance(
      HARDHAT_ACCOUNT_1.address
    );
    expect(vaultAfterDeposit - vaultAfterRelease).toBe(RELEASE_AMOUNT);
    expect(recipientAfterRelease - recipientBeforeRelease).toBe(RELEASE_AMOUNT);
  }, 120_000);
});
