## Context

See `proposal.md` for problem motivation and scope boundary.
The repository contains core routing interfaces and settlement rails inside `@zip-0/cctp-bridge` (`PaymentRoutingEngine`, `ISettlementRail`, `PaymentRouteQuote`). Currently, no SDK package or REST server workspace exists under `packages/` or `apps/`, leaving root `pnpm dev` broken.

## Goals / Non-Goals

**Goals:**
- Provide a clean, lightweight `@zip-0/sdk` package exporting `Zip0Client` targeting Node and browser environments.
- Provide `apps/gateway` HTTP service exposing the four canonical endpoints (`/v1/payments/quote`, `/v1/payments/transfer`, `/v1/payments/:id`, `/v1/webhooks`) and `/health`.
- Integrate `apps/gateway` with `PaymentRoutingEngine` for route discovery and fee calculation.
- Fix root `package.json` scripts so `pnpm dev` starts the gateway cleanly.
- Deliver comprehensive Vitest unit and integration tests.

**Non-Goals:**
- Distributed webhook retry queue / dead-letter exchanges (in-memory notification dispatch is sufficient for Phase 4).
- User authentication beyond static API key validation (`X-API-Key` or Bearer token).
- Frontend UI dashboard.

## Decisions

### 1. SDK Implementation: Native Fetch & Zero Heavy Dependencies
- **Choice**: Implement `Zip0Client` using standard `fetch` with typed interfaces and zero heavy blockchain dependencies (e.g. avoid requiring full Hardhat or Ethers in client bundles).
- **Alternative**: Packaging web3/ethers inside the SDK. Rejected because institutions integrating a payments SDK only need clean HTTP communication with the gateway; signer utilities can be accepted as raw parameters.

### 2. Gateway Server: Minimal Lightweight Express Server
- **Choice**: Use Express with JSON body parsing, CORS, and modular route handlers under `apps/gateway`.
- **Alternative**: Fastify or custom Node `http` listener. Express was chosen for simplicity, standard middleware support, and instant developer ergonomic familiarity.

### 3. Monorepo Integration via pnpm Workspaces
- **Choice**: Register `apps/gateway` under `apps/*` and `@zip-0/sdk` under `packages/*` according to `pnpm-workspace.yaml`.
- **Alternative**: Combining SDK and Gateway in a single package. Rejected to preserve clean separation between public consumer SDK and internal server execution.

## Risks / Trade-offs

- **[Risk]** Root workspace dependency or TypeScript resolution mismatches when creating new packages.  
  → **Mitigation**: Standardize `tsconfig.json` extending root or sibling presets and ensure `pnpm-workspace.yaml` matches paths.
- **[Risk]** `PaymentRoutingEngine` configuration required by `apps/gateway`.  
  → **Mitigation**: Instantiate `PaymentRoutingEngine` with default supported rails and fallback options cleanly injected into router endpoints.
