# crosschain-bridge-engine Specification

## Purpose
Orchestrates cross-chain payment lifecycles between HashKey Chain (HSK) and Stellar (Pollar SDK) with automatic settlement, gas sponsorship, and error recovery.
## Requirements
### Requirement: HSK Payment Event Ingestion
The bridge engine SHALL monitor HashKey Chain RPC for `PaymentInitiated` events emitted by the vault contract and register them in the pending payment registry.

#### Scenario: Detection of on-chain deposit
- **WHEN** a `PaymentInitiated` event is mined and confirmed on HashKey Chain
- **THEN** the engine extracts the payment metadata, validates domain recipient format, and transitions status to `PROCESSING`.

### Requirement: Stellar Settlement via Pollar
The bridge engine SHALL route incoming payments destined for Stellar to the Pollar platform API to credit the destination account in Stellar USDC.

#### Scenario: Successful credit to Stellar recipient
- **WHEN** the engine processes an HSK deposit targeting Stellar domain (21)
- **THEN** it triggers payment settlement via Pollar and records the resulting transaction hash upon confirmation.

### Requirement: Reverse Settlement to HSK
The bridge engine SHALL detect incoming payments confirmed through Pollar on Stellar and dispatch a release transaction to the HSK Payment Vault.

#### Scenario: Pollar payment releases funds in HSK
- **WHEN** Pollar confirms a payment intended for an HSK EVM address
- **THEN** the engine relayer signs and submits `releasePayment` to the HSK vault, paying gas fees on behalf of the recipient.

### Requirement: Strategy-Based Multi-Rail Routing
The payment routing engine SHALL evaluate source and destination network capabilities and dispatch payments to either `CctpSettlementRail` or `VaultSettlementRail`.

#### Scenario: Selection of CCTP rail for supported EVM pairs
- **WHEN** both source and destination chain IDs support Circle CCTP natively
- **THEN** the router routes the payment to `CctpSettlementRail` avoiding private liquidity pools.

#### Scenario: Fallback to Vault rail for non-CCTP networks
- **WHEN** either the source or destination chain does not support native Circle CCTP
- **THEN** the router delegates settlement to `VaultSettlementRail` using liquidity pool vaults.

### Requirement: Strict Recipient Address Validation for Vault Releases
The vault settlement rail SHALL validate that the destination recipient is a valid 20-byte EVM address formatted as a lowercase or checksummed hex string prefixed with `0x` before calling the underlying vault contract release method.

#### Scenario: Valid EVM recipient address passes validation
- **WHEN** a settlement execution is dispatched with a valid 40-character hex EVM recipient starting with `0x`
- **THEN** the rail formats and passes the address to `releasePayment` without error.

#### Scenario: Stellar recipient address is rejected
- **WHEN** a settlement execution is dispatched with a Stellar address (e.g. starting with `G`)
- **THEN** the rail throws a `BridgeError` with code `INVALID_RECIPIENT` and does not release funds.

#### Scenario: Malformed recipient string is rejected
- **WHEN** a settlement execution is dispatched with an invalid recipient string (such as truncated hex, empty string, or invalid characters)
- **THEN** the rail throws a `BridgeError` with code `INVALID_RECIPIENT`.

