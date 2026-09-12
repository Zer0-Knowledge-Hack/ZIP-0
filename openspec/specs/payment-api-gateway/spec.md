# payment-api-gateway Specification

## Purpose
Exposes a clean REST API interface and programmatic SDK (`@zip-0/sdk`) for external B2B institutions, governments, and fintechs to create and track cross-border payments.
## Requirements
### Requirement: Payment Quote and Route Selection Endpoint
The gateway SHALL expose a `/v1/payments/quote` endpoint that determines the settlement rail, estimated finality, and execution parameters.

#### Scenario: Route calculation for institutional transfer
- **WHEN** a client requests a quote for a corridor between Polygon and Avalanche
- **THEN** the gateway returns `CCTP_BURN_MINT` as the selected rail along with zero-slippage fee calculation.

### Requirement: Payment Initiation and Webhook Notification
The gateway SHALL accept `/v1/payments/transfer` requests and dispatch HTTP webhook notifications upon status changes.

#### Scenario: Final settlement notification via webhook
- **WHEN** an on-chain settlement is finalized on the destination chain
- **THEN** the system dispatches a signed `payment.settled` webhook payload to the subscriber URL with transaction hashes.

