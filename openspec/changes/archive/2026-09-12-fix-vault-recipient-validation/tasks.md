## 1. Core Error & Validation Updates

- [x] 1.1 Add `INVALID_RECIPIENT = "INVALID_RECIPIENT"` to `ErrorCode` in `packages/cctp-bridge/src/core/errors.ts`
- [x] 1.2 Update `executeSettlement` in `packages/cctp-bridge/src/adapters/vault/vaultRail.ts` to validate recipient address with `/^0x[a-fA-F0-9]{40}$/` and throw `BridgeError(ErrorCode.INVALID_RECIPIENT, ...)` on failure

## 2. Testing & Verification

- [x] 2.1 Add unit tests in `packages/cctp-bridge/test/vault-settlement-rail.test.ts` verifying rejection of Stellar G... addresses, malformed strings, and acceptance of valid EVM addresses
- [x] 2.2 Run full test suite with `pnpm --filter @zip-0/cctp-bridge test` and ensure all tests pass
