# AGENTS.md — ZIP-0 Workspace Instructions

## Strict Tooling & Development Directives

### 1. Package Manager Directive

**NEVER use `npm` or `yarn`. ALWAYS use `pnpm`.**

- Install dependencies: `pnpm add <package>` or `pnpm --filter <workspace> add <package>`
- Run scripts: `pnpm <script>` or `pnpm --filter <workspace> <script>`
- Workspace builds: `pnpm -r build`

### 2. Testing Framework Directive

**ALWAYS use `vitest` as the primary test runner for TypeScript, integration, and SDK tests.**

- Run tests: `pnpm --filter <workspace> test` or `pnpm -r test`
- Contract tests run via Hardhat or Vitest runner with EDR/local node.
- Write clear unit and end-to-end tests following TDD principles.

### 3. Code Quality & Linter Directive

**ALWAYS use `eslint` for code linting across all packages and applications.**

- Lint check: `pnpm lint` or `pnpm --filter <workspace> lint`
- Fix linting issues before committing or validating specs.

---

## Project Scope & Architectural Priorities

1. **Multi-EVM Symmetry (Avalanche Fuji Priority & HSK Supported)**:
   - Any EVM contract (`ZIP0PaymentVault.sol`), adapter, or workflow must run on any EVM chain.
   - **Avalanche Fuji (Chain ID: 43113)** is the active deployment target for the Buildathon Cochabamba 2026 Bounty.
   - **HashKey Chain (HSK)** is fully supported symmetrically (ready to deploy via Chain ID 133 when testnet restores).
2. **Circle USDC & Pollar Harmony**:
   - Native Circle USDC contract addresses are harmonized across Stellar and Avalanche networks.
   - Isolated `.env` configuration per package (`packages/contracts-evm/.env` and `packages/cctp-bridge/.env`).
3. **Testing & Deployment Flow**:
   - **Local First**: All smart contract and relayer integration flows MUST be tested locally first using a local Hardhat node (`pnpm hardhat node` / in-memory local network) with `MockUSDC`.
   - **Testnet Second**: Deploy and test on Avalanche Fuji Testnet (Chain ID: 43113) or HSK Testnet.
4. **Pollar SDK (Stellar)**:
   - Source/Destination for cross-chain payments in USDC, interconnected via the Relayer engine.
5. **OpenSpec & Gentle-AI**:
   - Planning, delta specs, and task tracking follow OpenSpec workflow (`openspec/changes/feat-hsk-cctp-payment-bridge`).
6. **Architecture Documentation**:
   - Canonical architecture reference in [`spec/Payment-Bridge-Architecture.md`](./spec/Payment-Bridge-Architecture.md).
