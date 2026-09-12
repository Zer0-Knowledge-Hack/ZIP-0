## Why

In `packages/cctp-bridge/src/adapters/vault/vaultRail.ts`, `executeSettlement()` currently truncates non-EVM destination recipients (such as Stellar `G...` base32 addresses) to 40 characters and prepends `0x` with a TypeScript cast `as \`0x${string}\``. This creates a syntactically valid EVM address that no one controls, causing permanent fund loss upon `releasePayment()`.

## What Changes

- Add `INVALID_RECIPIENT = "INVALID_RECIPIENT"` to `ErrorCode` in `packages/cctp-bridge/src/core/errors.ts`.
- In `VaultSettlementRail.executeSettlement()`, strictly validate that `intent.destinationRecipient` matches `/^0x[a-fA-F0-9]{40}$/`.
- If recipient is non-EVM or malformed, throw `BridgeError(ErrorCode.INVALID_RECIPIENT, ...)` instead of truncating.
- Add unit tests verifying non-EVM addresses (like Stellar `G...`) and malformed strings are rejected and that valid 20-byte EVM addresses pass normally.

## Capabilities

### Modified Capabilities
- `crosschain-bridge-engine`: Adds strict EVM recipient format validation to the vault settlement rail before executing releases, rejecting non-EVM recipients to prevent fund loss.

## Impact

- `packages/cctp-bridge/src/core/errors.ts`: New `ErrorCode.INVALID_RECIPIENT` enum value.
- `packages/cctp-bridge/src/adapters/vault/vaultRail.ts`: Strict regex validation on `destinationRecipient`.
- `packages/cctp-bridge/test/`: Comprehensive unit tests for recipient validation.
