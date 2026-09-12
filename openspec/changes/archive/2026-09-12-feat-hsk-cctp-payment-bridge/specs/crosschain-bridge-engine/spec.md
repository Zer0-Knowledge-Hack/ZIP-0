## Purpose

Orchestrates cross-chain payment lifecycles between HashKey Chain (HSK) and Stellar (Pollar SDK) with automatic settlement, gas sponsorship, and error recovery.

## ADDED Requirements

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
