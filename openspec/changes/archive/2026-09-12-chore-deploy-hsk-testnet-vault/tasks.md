## 1. Preparation & Safety Guard Adjustment

- [x] 1.1 Update `packages/contracts-evm/scripts/deploy.ts` to allow the testnet signer on `hskTestnet` while preserving strict safeguards on `hskMainnet`.
- [x] 1.2 Compile contracts and execute EVM test suite (`pnpm --filter @zip-0/contracts-evm test`) to confirm clean local state.

## 2. On-Chain Deployment & Verification

- [x] 2.1 Execute `pnpm --filter @zip-0/contracts-evm deploy:hsk-testnet` against HashKey Chain Testnet (133).
- [x] 2.2 Verify on-chain runtime bytecode, `RELAYER_ROLE` assignment, and initial 50,000 MockUSDC liquidity seed.

## 3. Documentation & Evidence

- [x] 3.1 Update `README.md` networks table with the newly deployed HSK testnet vault and MockUSDC addresses.
- [x] 3.2 Update `docs/project-status.md` with the new deployment addresses, transaction hashes, and bytecode verification.
- [x] 3.3 Run `pnpm -r test` and `pnpm -r build` to ensure monorepo integrity.
