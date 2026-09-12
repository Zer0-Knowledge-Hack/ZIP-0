## 1. Smart Contracts Package Setup & Vault Contract

- [x] 1.1 Initialize `packages/contracts-evm` with Hardhat/Foundry, TypeScript, and OpenZeppelin v5 dependencies
- [x] 1.2 Implement `ZIP0PaymentVault.sol` supporting deposit, EIP-2612 permit, and relayer release in `packages/contracts-evm/contracts/`
- [x] 1.3 Add unit tests for `ZIP0PaymentVault` covering access control, permit validation, and event emission
- [x] 1.4 Add deployment scripts with parameterized chain configuration for HashKey Chain Testnet (133) and Avalanche Fuji (43113)

## 2. CCTP Bridge Core & HSK Adapter

- [x] 2.1 Initialize `packages/cctp-bridge` package structure and TypeScript configuration
- [x] 2.2 Implement domain models, error definitions, and adapter interfaces in `src/core/`
- [x] 2.3 Implement HashKey Chain Viem client, vault wrapper, and event listeners in `src/adapters/hsk/`
- [x] 2.4 Add unit tests and mocks for HSK adapter contract interactions

## 3. Stellar Pollar Adapter & Relayer Engine

- [x] 3.1 Implement Pollar SDK client wrapper and Stellar ledger transaction listener in `src/adapters/pollar/`
- [x] 3.2 Implement Circle Iris attestation client in `src/adapters/cctp/` for standard CCTP destination networks
- [x] 3.3 Implement bidirectional relayer state machine and retry dispatch queue in `src/relayer/`
- [x] 3.4 Implement root facade `BridgeClient` in `src/index.ts` exporting high-level payment and bridging operations
- [x] 3.5 Add end-to-end unit and integration tests verifying HSK-to-Stellar and Stellar-to-HSK execution flows

## 4. Local Node Testing & Tooling Standards (Vitest & ESLint)

- [x] 4.1 Configure ESLint across the monorepo packages for code style and quality enforcement
- [x] 4.2 Create local node start and deployment orchestration script (`pnpm run node:local` & `pnpm run deploy:local`)
- [x] 4.3 Add end-to-end integration test running with Vitest against the local Hardhat node with MockUSDC

## 5. Bidirectional Live Testnet Execution & Secure Wallet Management

- [x] 5.1 Isolate test wallets in git-ignored `test-wallets.json` removing sensitive keys from `.env`
- [x] 5.2 Implement live on-chain bidirectional runner in `packages/cctp-bridge/scripts/test-payment-cli.ts` (`pnpm test:payment`)
- [x] 5.3 Execute and verify Flujo 1: Stellar (Pollar / Horizon) ➔ Avalanche Fuji (ZIP0PaymentVault)
- [x] 5.4 Execute and verify Flujo 2: Avalanche Fuji (Alice deposit) ➔ Stellar (Charlie settlement)
- [x] 5.5 Document Pollar gas sponsorship vs USDC balance mechanics and update architecture docs
