## 1. Monorepo Setup & Workspace Scaffolding

- [x] 1.1 Scaffold `packages/sdk` with `package.json`, `tsconfig.json`, and source structure
- [x] 1.2 Scaffold `apps/gateway` with `package.json`, `tsconfig.json`, and Express server structure
- [x] 1.3 Correct root `package.json` `dev` script to run `apps/gateway`

## 2. Implement @zip-0/sdk

- [x] 2.1 Implement typed `Zip0Client` with methods for `payments.quote()`, `payments.create()`, `payments.get()`, and `webhooks.subscribe()`
- [x] 2.2 Write Vitest unit tests for `Zip0Client` verifying HTTP requests, payload encoding, and error handling
- [x] 2.3 Validate build output of `@zip-0/sdk`

## 3. Implement REST Gateway (apps/gateway)

- [x] 3.1 Implement base Express server with CORS, JSON body parser, and `GET /health`
- [x] 3.2 Implement `POST /v1/payments/quote` utilizing `PaymentRoutingEngine` from core
- [x] 3.3 Implement `POST /v1/payments/transfer` for payment initiation with ERC-3009 signature or deposit payloads
- [x] 3.4 Implement `GET /v1/payments/:id` for payment status and transaction hash lookup
- [x] 3.5 Implement `POST /v1/webhooks` for subscribing to settlement lifecycle events

## 4. Integration Testing & Linting

- [x] 4.1 Write Vitest integration tests for Gateway REST endpoints
- [x] 4.2 Write Vitest end-to-end tests validating `Zip0Client` interacting with the Gateway
- [x] 4.3 Run `pnpm lint` across all packages and fix any linting errors

## 5. Documentation Updates

- [x] 5.1 Document `@zip-0/sdk` and REST API endpoints with runnable examples in `README.md`
- [x] 5.2 Update `docs/project-status.md` reflecting completed SDK and REST Gateway implementation
- [x] 5.3 Update `spec/Payment-Bridge-Architecture.md` §6
