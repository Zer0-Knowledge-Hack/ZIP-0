# gasless-payment-authorization Specification

## Purpose
Enables institutional participants to authorize USDC payments off-chain using EIP-712 / ERC-3009 signatures without possessing or paying native gas tokens.
## Requirements
### Requirement: ERC-3009 Transfer With Authorization
The payment relayer SHALL accept cryptographically signed `transferWithAuthorization` payloads and submit the transaction on-chain paying the required native gas.

#### Scenario: Gasless payment submission by institutional payer
- **WHEN** a client provides a valid EIP-712 typed signature for `transferWithAuthorization`
- **THEN** the relayer verifies signature validity, anti-replay nonce, and expiry before submitting the transaction to the network.

### Requirement: Anti-Replay and Expiry Validation
The system SHALL validate nonce uniqueness and block expired authorization payloads before relaying.

#### Scenario: Replay attempt of prior authorization
- **WHEN** an authorization payload with an already-consumed nonce is submitted
- **THEN** the engine rejects the submission immediately with an authorization error and does not broadcast to RPC.

