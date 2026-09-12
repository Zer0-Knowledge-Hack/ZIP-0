# Implementation Tasks: Deploy to HashKey Chain Testnet (133)

## 1. Deploy Script Enhancement
- [x] 1.1 Update `packages/contracts-evm/scripts/deploy.ts` to support MockUSDC seeding (e.g. 50,000 USDC) to the vault.
- [x] 1.2 Add on-chain assertions in `deploy.ts`: verify `eth_getCode(vaultAddress)`, `balanceOf(vaultAddress) > 0`, and `hasRole(RELAYER_ROLE)`.
- [x] 1.3 Verify script compiles cleanly and runs against in-memory Hardhat network.

## 2. Live HSK Testnet Deployment
- [x] 2.1 Run `pnpm --filter @zip-0/contracts-evm deploy:hsk-testnet` with the funded testnet wallet.
- [x] 2.2 Record deployed `MockUSDC` address, `ZIP0PaymentVault` address, and transaction hashes.
- [x] 2.3 Verify bytecode on HashKey Testnet Blockscout explorer (`https://testnet-explorer.hsk.xyz`).

## 3. Documentation & Verification
- [x] 3.1 Update `README.md` networks table with the deployed HSK Testnet contract addresses and explorer links.
- [x] 3.2 Update `docs/project-status.md` and repository status.
- [x] 3.3 Run `openspec validate` and full workspace test suite `pnpm -r test`.
- [x] 3.4 Post deployment comment on GitHub Issue #3.
