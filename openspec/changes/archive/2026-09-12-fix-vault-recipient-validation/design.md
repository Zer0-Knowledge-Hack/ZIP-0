## Context

See `proposal.md` for motivation. Currently, `packages/cctp-bridge/src/adapters/vault/vaultRail.ts` uses:
```ts
const recipient = (
  intent.destinationRecipient.startsWith("0x")
    ? intent.destinationRecipient
    : `0x${intent.destinationRecipient.slice(0, 40)}`
) as `0x${string}`;
```
This coerces any string (including Stellar addresses `G...`) into an arbitrary 20-byte address, risking irreversible fund loss upon `releasePayment()`.

## Goals / Non-Goals

**Goals:**
- Enforce strict 20-byte hexadecimal address checking with `0x` prefix (`/^0x[a-fA-F0-9]{40}$/`).
- Throw `BridgeError(ErrorCode.INVALID_RECIPIENT, ...)` on invalid format before interacting with the vault adapter.
- Add `INVALID_RECIPIENT` to `ErrorCode` in `core/errors.ts`.
- Ensure type-safe assignment to `` `0x${string}` `` only after validation.

**Non-Goals:**
- Converting Stellar addresses on EVM release paths. A Stellar destination on an EVM release path is an invalid route, not an address that can be automatically reshaped.

## Decisions

- **Decision 1: Regex vs viem `isAddress`**:
  - We can use `/^0x[a-fA-F0-9]{40}$/.test(recipient)` or viem's `isAddress`. Standard viem `isAddress` or exact regex `/^0x[a-fA-F0-9]{40}$/` guarantees valid 20-byte EVM address syntax. Using regex avoids extra dependencies in the core adapter and directly verifies length and characters.
- **Decision 2: Error Code**:
  - Add `INVALID_RECIPIENT = "INVALID_RECIPIENT"` to `ErrorCode` enum in `src/core/errors.ts`.

## Risks / Trade-offs

- [Risk] Existing callers passing malformed or Stellar addresses will be rejected immediately. → Mitigation: This is the intended security behavior; returning or calling an uncontrolled address is fund loss.
