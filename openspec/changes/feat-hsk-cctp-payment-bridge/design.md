## Context

HashKey Chain (HSK) is an OP-Stack based EVM Layer-2 network where native Circle CCTP V2 contracts are not officially deployed. To achieve seamless cross-chain payment interoperability between Stellar (Pollar SDK) and HSK, a custom EVM Payment Vault contract is paired with an asynchronous Relayer bridge service. See `proposal.md` for motivation and [`docs/HSK-Payment-Bridge-Architecture.md`](file:///d:/Proyectos/Blockchain/ZIP-0/docs/HSK-Payment-Bridge-Architecture.md) for architectural schemas.

## Goals / Non-Goals

**Goals:**
- Provide `ZIP0PaymentVault.sol` in `packages/contracts-evm` supporting standard ERC-20 transfers, EIP-2612 gasless permits, and role-authorized relayer execution.
- Implement `packages/cctp-bridge` with clean architectural separation between domain entities and network-specific adapters (`hsk`, `pollar`, `cctp`).
- Ensure EVM symmetry: all contracts and EVM client adapters must run identically on HSK Testnet and Avalanche Fuji.
- Provide a resilient relayer state machine with retry backoff and idempotency.
- **Strict Quality Tooling**: Enforce `vitest` for test runner execution and `eslint` for code linting.
- **Local-First Verification**: Support executing full end-to-end flows against a local Hardhat node with pre-funded test accounts before broadcasting to testnet.

**Non-Goals:**
- Deploying custom CCTP bridge contracts on chains where Circle CCTP is already native (e.g. Avalanche).
- Implementing decentralized validator consensus or MPC networks for the relayer (a trusted/multisig relayer role is used for MVP/hackathon scope).
- Supporting non-USDC tokens in the initial release.

## Decisions

### Decision 1: Dual-Engine Vault & Relayer for HSK
- **Rationale**: Because Circle does not have Iris Attestation infrastructure for HSK, an on-chain vault with a trusted relayer role allows instant payment release and gas abstraction for end users.
- **Alternatives Considered**: Waiting for Circle official HSK deployment (unfeasible for timeline) or third-party bridge DEX swaps (high slippage and dependency).

### Decision 2: EIP-2612 Permit for One-Click User Payments
- **Rationale**: Eliminates the traditional two-step EVM approval workflow (`approve` followed by `transferFrom`), allowing user interfaces to execute gasless or single-signature deposits.
- **Alternatives Considered**: Standard ERC-20 approve/transferFrom only (poor mobile/UX conversion).

### Decision 3: Viem for EVM Adapters, Vitest for Tests, ESLint for Linters
- **Rationale**: Viem offers lightweight, type-safe RPC client primitives. Vitest provides blistering-fast, ESM-native testing with unified mocks. ESLint guarantees code conventions across all packages.
- **Alternatives Considered**: Jest (slow, ESM issues with modern packages).

### Decision 4: Local Node Verification Strategy before Testnet
- **Rationale**: Testing directly on public testnets introduces faucet rate-limits, RPC flakiness, and transaction confirmation lag.
- **Mechanism**:
  - **Local**: Run `pnpm hardhat node` on `http://127.0.0.1:8545`. Hardhat provides 20 pre-funded accounts (10,000 ETH each). The deploy script automatically deploys `MockUSDC.sol` and funds the test payer and vault.
  - **Testnet**: Configure `HSK_RELAYER_PRIVATE_KEY` with a funded testnet EOA (via HSK Testnet Faucet) and point `HSK_USDC_ADDRESS` to the testnet USDC token.

## Risks / Trade-offs

- **[Vault Liquidity Exhaustion on HSK]** → Relayer monitors vault USDC reserves and triggers alerts or automated rebalancing via CCTP hub when balance drops below safety thresholds.
- **[Network RPC Latency/Disconnects]** → Relayer uses exponential backoff and persistent event cursor polling to prevent double releases or missed deposits.
- **[HashKey Chain Testnet Faucet Availability]** → Local Hardhat node allows complete local offline verification without relying on external faucets.
