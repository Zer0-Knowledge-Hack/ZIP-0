## Purpose

Provides native Circle Cross-Chain Transfer Protocol (CCTP) 1:1 burn-and-mint settlement across supported EVM networks without requiring private liquidity pools.

## ADDED Requirements

### Requirement: Direct CCTP Burn and Mint Execution
The settlement engine SHALL burn native USDC on the source EVM chain and mint native USDC on the destination EVM chain via Circle TokenMessenger without intermediate private liquidity pools.

#### Scenario: Cross-chain settlement via CCTP
- **WHEN** an institutional payment intent is routed between two CCTP-enabled chains (e.g. Polygon and Avalanche)
- **THEN** the system executes `depositForBurn` on the source `TokenMessenger`, retrieves the Iris attestation, and completes `receiveMessage` on the destination chain.

### Requirement: Zero Slippage and Unlimited Volume Guarantee
The settlement engine SHALL guarantee 1:1 nominal USDC settlement ratio regardless of transaction size up to network limits.

#### Scenario: Large institutional transfer execution
- **WHEN** an institutional transfer exceeding $1,000,000 USDC is submitted on a CCTP-supported corridor
- **THEN** the exact principal amount is minted to the recipient address without pool price impact or slippage fee.
