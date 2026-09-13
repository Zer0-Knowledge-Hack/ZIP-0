# Design: HashKey Chain Testnet Deployment & Liquidity Seeding

## Context & Motivation
Issue #3 specifies deploying `ZIP0PaymentVault` and `MockUSDC` to HashKey Chain Testnet (Chain ID 133). HSK testnet does not have an official Circle USDC deployment; therefore, a local `MockUSDC` token (ERC-20 with 6 decimals and permit support) must be deployed first as the settlement currency for the vault.

Additionally, for cross-chain settlements where inbound payments are released to recipients on HSK (`releasePayment`), the vault must hold a balance of USDC. Seeding liquidity directly during deployment ensures the vault is immediately functional for end-to-end integration without manual intervention.

## Architectural Decisions

### 1. Zero Contract Code Changes
The contracts in `packages/contracts-evm/contracts/` (`ZIP0PaymentVault.sol` and `test/MockUSDC.sol`) remain unchanged to avoid invalidating existing audit footprints or test suites. All deployment orchestration is handled via Hardhat deployment scripts.

### 2. Automated Liquidity Seeding in `deploy.ts`
When `deploy.ts` deploys `MockUSDC` on testnets, the deployer receives 1,000,000 MockUSDC. The script will automatically transfer 50,000 MockUSDC (`50,000 * 10^6` units) to the deployed `ZIP0PaymentVault` address, verifying the vault's balance immediately after transfer.

### 3. Verification & Sanity Checks
Immediately following deployment and seeding:
- Fetch and assert `eth_getCode(vaultAddress) !== "0x"` to guarantee bytecode is deployed on HashKey Chain.
- Query `vault.hasRole(RELAYER_ROLE, relayerAddress)` to confirm relayer authorization.
- Query `mockUSDC.balanceOf(vaultAddress)` to confirm liquidity presence.
- Output the exact Blockscout explorer links and Hardhat verify command for the user and repository records.

### 4. Canonical RPC & Configuration
Use `https://testnet.hsk.xyz` (the live, active RPC) with Chain ID 133, as documented in `docs/hsk-chain-integration.md`.
