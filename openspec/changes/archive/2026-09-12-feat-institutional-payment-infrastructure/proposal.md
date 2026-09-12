## Why

Institutional cross-border settlements (such as inter-bank payments, sovereign transfers, and multinational treasury flows) cannot rely on private liquidity pools or manual token swaps. Current bridge systems require high idle collateral and force corporate entities to acquire native gas tokens (POL, AVAX, ETH).

This change introduces an institutional-grade, multi-chain payment engine using Circle CCTP (1:1 Burn & Mint with zero liquidity pool requirement) across EVM chains (Polygon PoS, Avalanche, Arbitrum, Base), gas abstraction via ERC-3009 (`transferWithAuthorization`), and a clean Ports & Adapters core consumed via REST API and SDK.

## What Changes

- **Clean Core Refactor**: Decouple payment routing into a strategy pattern (`ISettlementRail`) with `CctpSettlementRail` for CCTP-enabled chains and `VaultSettlementRail` for non-CCTP chains.
- **Native Circle CCTP Rail**: Integrate Circle Cross-Chain Transfer Protocol (`TokenMessenger` & `MessageTransmitter`) for unlimited institutional volume without slippage.
- **Gasless Payment Authorization (ERC-3009)**: Enable EIP-712 off-chain authorization so institutions only hold and transact in USDC without touching native gas tokens.
- **Pollar EVM Alignment**: Integrate Pollar on Polygon (EVM account) for gasless onboarding; record Stellar native CCTP as an open roadmap milestone.
- **API & SDK Layer**: Provide REST endpoints (`/v1/payments/quote`, `/v1/payments/transfer`, `/v1/payments/:id`) and typed `@zip-0/sdk`.

## Capabilities

### New Capabilities
- `institutional-cctp-rail`: Direct 1:1 Circle CCTP Burn & Mint cross-chain settlement across EVM networks (Polygon, Avalanche Fuji, Arbitrum, Base) without private liquidity pools.
- `gasless-payment-authorization`: EIP-712 and ERC-3009 (`transferWithAuthorization`) execution allowing institutional payers to submit signed USDC authorizations without paying native gas.
- `payment-api-gateway`: REST API gateway and `@zip-0/sdk` high-level client for B2B payment initiation, status tracking, and webhook dispatch.

### Modified Capabilities
- `crosschain-bridge-engine`: Migrate from tightly-coupled HSK/Stellar methods to an extensible `PaymentRoutingEngine` using decoupled `ISettlementRail` adapters.

## Impact

- `packages/cctp-bridge/src/core/`: Interfaces update (`interfaces.ts`, `types.ts`) with new dual-rail abstractions.
- `packages/cctp-bridge/src/adapters/`: Adds `cctp/` adapter, adapts `evm/` and `pollar/` for Polygon EVM accounts.
- `packages/cctp-bridge/src/relayer/`: Adds Iris attestation listener and ERC-3009 relayer execution.
- `packages/cctp-bridge/src/api/`: New REST API gateway and SDK exports.
