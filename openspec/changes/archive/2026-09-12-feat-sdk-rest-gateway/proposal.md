## Why

Integrating with ZIP-0 currently requires importing internal classes and having direct knowledge of low-level chain IDs, domain parameters, and relayer wiring. To enable external B2B institutions and fintechs to orchestrate cross-border payments cleanly without exposing internal relayer plumbing, ZIP-0 requires a public typed client SDK (`@zip-0/sdk`) and an HTTP REST gateway (`apps/gateway`). Additionally, root `package.json` scripts (`pnpm dev`) reference non-existent workspaces, preventing standard local development.

## What Changes

- **Create `@zip-0/sdk` package**: A typed TypeScript client (`Zip0Client`) exposing payments orchestration (`payments.quote()`, `payments.create()`, `payments.get()`, `webhooks.subscribe()`) without leaking rail or domain internals.
- **Create `apps/gateway` REST workspace**: Express/Fastify-based REST server exposing:
  - `POST /v1/payments/quote`: Route estimation, fee structure, and rail selection via `PaymentRoutingEngine`.
  - `POST /v1/payments/transfer`: Payment initiation with ERC-3009 authorization or vault deposit payload.
  - `GET /v1/payments/:id`: Real-time status lookup and on-chain transaction hashes.
  - `POST /v1/webhooks`: Event subscription registration for payment state transitions.
- **Fix Root Workspace Scripts**: Correct `pnpm dev` in root `package.json` to run the gateway along with other active services instead of targeting stale filters.
- **Vitest Testing Suite**: Unit and integration test coverage for both `@zip-0/sdk` and `apps/gateway`.
- **Documentation**: Provide clear SDK quickstart in `README.md`, update `docs/project-status.md`, and reconcile §6 in `spec/Payment-Bridge-Architecture.md`.

## Capabilities

### Modified Capabilities
- `payment-api-gateway`: Extend specifications to include explicit SDK client contracts (`@zip-0/sdk`), `GET /v1/payments/:id` status queries, and workspace runner requirements.

## Impact

- **New Workspaces**: `packages/sdk` and `apps/gateway` added to the pnpm monorepo.
- **Root Scripts**: `package.json` `dev` command updated.
- **Dependencies**: SDK depends only on public types and HTTP interfaces, while `apps/gateway` consumes `@zip-0/cctp-bridge` core interfaces.
