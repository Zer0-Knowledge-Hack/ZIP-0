## Why

HashKey Chain (HSK) lacks native Circle CCTP V2 contracts on-chain, creating a critical gap for applications requiring seamless cross-chain USDC settlement between Stellar (via Pollar SDK) and EVM ecosystems. Implementing an EVM-symmetrical Payment Vault and Relayer bridge solves this gap, prioritizing HSK while inherently providing instant compatibility with other EVM chains like Avalanche.

## What Changes

- Introduce `packages/contracts-evm` with `ZIP0PaymentVault.sol` supporting USDC deposits, EIP-2612 permit authorizations, role-based relayer payouts, and rebalancing.
- Introduce `packages/cctp-bridge` featuring clean domain abstractions, HSK Viem adapter, Pollar SDK Stellar adapter, and bidirectional relayer engine.
- Provide symmetrical EVM deployment configurations and scripts for HSK Testnet (Chain ID 133) and Avalanche Fuji (Chain ID 43113).
- Provide unified `BridgeClient` facade to allow backend orchestrators to execute and track cross-chain payments.

## Capabilities

### New Capabilities
- `hsk-payment-vault`: EVM smart contract specification for locking and releasing USDC payments on HashKey Chain with relayer execution and gas abstraction.
- `crosschain-bridge-engine`: Cross-chain payment bridging orchestrator connecting HashKey Chain EVM events with Pollar (Stellar) payment settlements and Circle CCTP.

### Modified Capabilities
<!-- None. This is the foundational implementation of the bridge capabilities. -->

## Impact

- **New Packages**: `packages/contracts-evm`, `packages/cctp-bridge`
- **Dependencies**: Viem, OpenZeppelin Contracts v5, `@pollar/core`, `@stellar/stellar-sdk`
- **APIs**: Exposes `BridgeClient` API for backend services and smart contract ABIs for HSK and EVM networks
