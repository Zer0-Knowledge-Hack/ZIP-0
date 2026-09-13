## Context

See `proposal.md` for motivation.
The EVM deployment script `packages/contracts-evm/scripts/deploy.ts` compiles and deploys `MockUSDC` and `ZIP0PaymentVault` to configured networks. The earlier deployment to HSK Testnet lacked recent PR additions (#25 refund timeout, #28 ERC-3009 gasless authorization).

## Goals / Non-Goals

**Goals:**
- Deploy `MockUSDC` and `ZIP0PaymentVault` to HSK Testnet (Chain ID 133).
- Verify runtime bytecode exists and matches current main ABI with `claimRefund`, `acknowledgePayment`, and `depositWithAuthorization`.
- Provision MockUSDC initial liquidity (50,000 USDC) to the vault.
- Update `README.md` and `docs/project-status.md` with verified addresses.

**Non-Goals:**
- Deploying to HSK mainnet (staff confirmed testnet satisfies the hackathon track).
- Redeploying Avalanche Fuji vault (already deployed and verified).

## Decisions

1. **Testnet Signer Configuration**:
   - Allow the active testnet signer to execute deployment on `hskTestnet`.
   - Maintain the `COMPROMISED_RELAYER` check on `hskMainnet` where real assets would be involved, while allowing testnet execution with developer-specified `RELAYER_ADDRESS` or testnet signer.

2. **Verification Strategy**:
   - Pre-deployment validation of compilation artifacts and test suite.
   - Post-deployment runtime bytecode verification and role verification on-chain.

## Risks / Trade-offs

- [HSK RPC latency / timeout] → Hardhat configured with `https://testnet.hsk.xyz` public RPC and default polling.
- [Token Address Mismatch] → Script logs deployed MockUSDC and vault addresses immediately for inclusion in documentation and downstream issues (#5, #6, #7).
