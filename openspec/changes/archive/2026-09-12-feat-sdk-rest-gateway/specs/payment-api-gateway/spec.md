## ADDED Requirements

### Requirement: Payment Status Lookup Endpoint
The gateway SHALL expose a `GET /v1/payments/:id` endpoint that retrieves the real-time settlement status, source transaction hash, and destination transaction hash of a payment.

#### Scenario: Querying an existing payment by ID
- **WHEN** a client submits a GET request to `/v1/payments/:id` for an active or completed payment
- **THEN** the gateway responds with HTTP 200 containing status (e.g. `PENDING`, `SETTLED`, `FAILED`), rail type, timestamps, and on-chain transaction hashes.

#### Scenario: Querying a non-existent payment ID
- **WHEN** a client submits a GET request to `/v1/payments/:id` for an unknown ID
- **THEN** the gateway responds with HTTP 404 and a structured error object.

### Requirement: Typed SDK Client Library
The system SHALL provide a TypeScript client library (`@zip-0/sdk`) that encapsulates quote calculation, payment creation, status querying, and webhook verification without requiring callers to handle low-level relayer or chain details directly.

#### Scenario: Fetching a route quote via SDK
- **WHEN** an application calls `zip0.payments.quote({ amount, sourceChain, destinationChain, recipient })`
- **THEN** the SDK issues the request to the gateway and returns a typed quote with estimated fees and chosen settlement rail.

#### Scenario: Tracking payment status via SDK
- **WHEN** an application calls `zip0.payments.get(paymentId)`
- **THEN** the SDK returns a typed payment record containing current status and transaction hashes.

### Requirement: Workspace Orchestration and Health Verification
The gateway application SHALL provide a health check endpoint at `GET /health` and be runnable in local development mode via `pnpm dev`.

#### Scenario: Gateway health check
- **WHEN** an HTTP GET request is received at `/health`
- **THEN** the gateway responds with HTTP 200 and `{ "status": "ok" }`.
