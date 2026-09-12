## 1. Core Domain Refactoring (Strategy Pattern & Interfaces)

- [x] 1.1 Update `packages/cctp-bridge/src/core/types.ts` with `SettlementRailType`, `PaymentIntent`, and `AuthorizationPayload`
- [x] 1.2 Update `packages/cctp-bridge/src/core/interfaces.ts` with `ISettlementRail`, `IPaymentRouter`, and `IGaslessAuthorizer`
- [x] 1.3 Implement `PaymentRoutingEngine` in `packages/cctp-bridge/src/core/router.ts`

## 2. Settlement Rails (CCTP & Vault)

- [x] 2.1 Implement `CctpSettlementRail` in `packages/cctp-bridge/src/adapters/cctp/cctpRail.ts` supporting Polygon and Avalanche Fuji
- [x] 2.2 Refactor `VaultSettlementRail` in `packages/cctp-bridge/src/adapters/vault/vaultRail.ts` wrapping `ZIP0PaymentVault`
- [x] 2.3 Update Pollar adapter for Polygon EVM accounts

## 3. Gasless Authorization (ERC-3009)

- [x] 3.1 Implement ERC-3009 EIP-712 payload builder and validator in `packages/cctp-bridge/src/core/erc3009.ts`
- [x] 3.2 Add relayer execution for signed authorizations in `packages/cctp-bridge/src/relayer/erc3009Relayer.ts`

## 4. API Gateway & SDK

- [x] 4.1 Implement REST API routing handlers (`/v1/payments/quote`, `/v1/payments/transfer`, `/v1/payments/:id`)
- [x] 4.2 Export typed client SDK (`Zip0Client`) from `packages/cctp-bridge/src/index.ts`

## 5. Verification & Testing

- [x] 5.1 Add Vitest tests for router, rails, and ERC-3009 authorization
- [x] 5.2 Run linting (`pnpm lint`) and full test suite (`pnpm -r test`)
