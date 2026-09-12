## Context

See `proposal.md` and `spec/Payment-Bridge-Architecture.md`. The existing bridge implementation in `packages/cctp-bridge` was coupled specifically to HSK-to-Stellar flows with an in-memory or single-destination relay. This design restructures the bridge package into a clean Hexagonal Architecture supporting dual-rail settlement (Circle CCTP Burn & Mint for institutional scale vs. Vault Relayer float for non-CCTP networks) with ERC-3009 gas abstraction.

## Goals / Non-Goals

**Goals:**
- Decouple payment routing into a strategy pattern (`ISettlementRail`) with `CctpSettlementRail` and `VaultSettlementRail`.
- Implement native Circle CCTP adapter (`depositForBurn`, Iris attestation retrieval, `receiveMessage`) for Polygon, Avalanche Fuji, Arbitrum, and Base.
- Implement ERC-3009 (`transferWithAuthorization`) signature verification and relaying to eliminate native gas token requirements for institutional payers.
- Expose a modular API Gateway and programmatic `@zip-0/sdk`.
- Maintain 100% backward compatibility for local testnet suites and existing Avalanche Fuji deployment.

**Non-Goals:**
- Deploying unofficial CCTP contracts on Stellar (waiting for official Circle Soroban deployment).
- Re-architecting existing Solidity contracts on Avalanche Fuji (the existing `ZIP0PaymentVault` remains intact and acts as the vault rail).

## Decisions

### 1. Strategy Pattern for Settlement Rails
- **Decision**: Define `ISettlementRail` in `core/interfaces.ts` with `supportsRoute()`, `estimateFee()`, and `executeSettlement()`.
- **Rationale**: Clean Architecture (Ports & Adapters) isolates chain logic. Adding a new chain or rail requires zero modifications to the routing engine.
- **Alternatives Considered**: Keeping unified monolithic orchestrator with chain if/else conditions (rejected: violates Open/Closed Principle and scales poorly).

### 2. Native CCTP Integration via Circle Official Contracts
- **Decision**: Use Circle's official `TokenMessenger` and `MessageTransmitter` contract ABIs across supported EVM networks.
- **Rationale**: Eliminates private liquidity pools, eliminates slippage, and supports multi-million dollar institutional transactions backed directly by Circle.
- **Alternatives Considered**: AMM/DEX swaps or private bridge pools (rejected: high slippage and capital inefficiency).

### 3. ERC-3009 Gas Abstraction for Institutional Payers
- **Decision**: Support `transferWithAuthorization` with EIP-712 typed data (`TransferWithAuthorization` struct).
- **Rationale**: Institutional entities operate strictly in USDC and cannot be expected to purchase or hold volatile gas tokens (POL, AVAX).
- **Alternatives Considered**: ERC-4337 Smart Contract Accounts only (rejected: requires wallet migration, whereas ERC-3009 works with existing EOA institutional wallets).

### 4. Polygon EVM Alignment for Pollar
- **Decision**: Configure Pollar client with Polygon EVM accounts.
- **Rationale**: Keeps Pollar users within EVM CCTP-supported rails immediately while tracking Stellar native CCTP for future integration.

## Risks / Trade-offs

- **CCTP Attestation Latency** → Mitigation: Engine processes transfers asynchronously, issuing immediate `PENDING` payment intents and dispatching Webhooks upon finality confirmation.
- **Relayer Gas Balance Depletion** → Mitigation: Relayer monitors native balance on supported chains and deducts an operational fee in USDC from settlements when configured.
