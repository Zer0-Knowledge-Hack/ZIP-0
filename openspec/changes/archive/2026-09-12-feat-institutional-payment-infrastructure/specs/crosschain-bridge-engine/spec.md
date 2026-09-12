## ADDED Requirements

### Requirement: Strategy-Based Multi-Rail Routing
The payment routing engine SHALL evaluate source and destination network capabilities and dispatch payments to either `CctpSettlementRail` or `VaultSettlementRail`.

#### Scenario: Selection of CCTP rail for supported EVM pairs
- **WHEN** both source and destination chain IDs support Circle CCTP natively
- **THEN** the router routes the payment to `CctpSettlementRail` avoiding private liquidity pools.

#### Scenario: Fallback to Vault rail for non-CCTP networks
- **WHEN** either the source or destination chain does not support native Circle CCTP
- **THEN** the router delegates settlement to `VaultSettlementRail` using liquidity pool vaults.
