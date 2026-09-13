# Project Status — What Is Built vs. What Is Designed

This document exists because `spec/Payment-Bridge-Architecture.md` describes the **target**
architecture, and reading it alone can leave the impression that more is implemented than actually
is. Everything below was verified by running the code and querying live networks, not by reading
the design document.

**Verified on:** 2026-09-12.

---

## Summary

| Component | State |
| :--- | :--- |
| `ZIP0PaymentVault.sol` | ✅ Built, tested, deployed on Avalanche Fuji & HSK Testnet |
| EIP-2612 gasless deposit | ✅ Built and tested |
| Relayer orchestration (EVM ↔ Stellar) | ✅ Built; local Hardhat integration proven |
| Pollar / Stellar adapter | ⚠️ Built, no live-network test |
| Ports & Adapters core (ISettlementRail / PaymentRoutingEngine) | ✅ Built and tested |
| CCTP settlement rail | ❌ Not started |
| ERC-3009 `transferWithAuthorization` | ✅ Vault deposit + EIP-712 signing/validation; standalone relayer broadcast not implemented |
| ZK privacy model (KYC-gated deposits) | 📝 Designed, not built — see [`zk-privacy-model.md`](zk-privacy-model.md) |
| `@zip-0/sdk` package | ✅ Built and tested (`packages/sdk`) |
| REST API gateway | ✅ Built and tested (`apps/gateway`) |
| Persistent payment state | ❌ Not started |

---

## What is built and proven

### Settlement vault

`packages/contracts-evm/contracts/ZIP0PaymentVault.sol` — 273 lines. Lock/release vault with
`AccessControl`, `ReentrancyGuard`, and `SafeERC20`.

Test evidence: `pnpm --filter @zip-0/contracts-evm test` → **19 passing**, covering initialization
and roles, deposit with event emission, duplicate-`paymentId` rejection, permit-based deposit,
relayer release, non-relayer rejection, insufficient-liquidity rejection, treasury rebalance, and
the payer refund path: relayer acknowledgement, refund after timeout, early-claim and non-payer
rejection, no refund of acknowledged or released payments, no double refund, and a reentrancy
attempt blocked by a malicious token.

Payer refund: a payer can call `claimRefund` after `REFUND_TIMEOUT` (24 h) if the relayer never
acknowledged the deposit. `acknowledgePayment` exists because a deposit never leaves `INITIATED`
on a successful settlement — without it, a payer could be credited on the destination chain and
still claim a refund here. The relayer calls it: `VaultSettlementRail` acknowledges each
EVM → Stellar deposit and waits for the confirmed transaction before crediting Stellar, and a
failed acknowledgement stops the settlement (#26). Verified against mocks only, like the rest of
the relayer.

Deployment evidence:
- Avalanche Fuji (`43113`): `0xF1ca5572DC03f84aB0f2e5806df336264375e1Fa` returns contract bytecode from `eth_getCode` and holds a non-zero USDC balance.
- HashKey Chain Testnet (`133`): `0x14e59806054773fc341377aEC472C07e500BCc86` (pointing to MockUSDC at `0x46a7BE8Cea2d9EB017D0a0277467E680bcA04f17`), verified on-chain runtime bytecode with 50,000 MockUSDC initial liquidity.

Both deployments predate `acknowledgePayment` and `claimRefund`, so their bytecode no longer
matches this repository. Redeploy before relying on the refund path — until then the relayer's
EVM → Stellar settlement fails against them, because its acknowledgement call reverts.

Bytecode size: 6,782 bytes init / 6,037 bytes deployed — comfortably under the EIP-170 24 KB limit.


### Settlement rail abstraction

`ISettlementRail` and `IPaymentRouter` are defined in `src/core/interfaces.ts`.
`PaymentRoutingEngine` (`src/routing/`) holds a registry of rails and selects one by route;
`VaultSettlementRail` (`src/rails/`) carries the lock/release behaviour that previously lived
inside `RelayerOrchestrator`.

Test evidence: 18 new tests covering rail selection, rail extensibility, failure handling, fee
delegation, route support, and both settlement directions.

The engine never branches on `railType`. A dedicated test registers a rail the engine has never
seen and asserts it works without modifying the engine — if that test ever needs an engine change
to pass, the abstraction has become decorative.

`RelayerOrchestrator` remains as a facade over the router with its original API unchanged, so the
five pre-existing tests pass untouched.

### Gasless deposits

`depositWithPermit()` is implemented and tested. HashKey Chain's bridged USDC
(`0x054ed45810DbBAb8B27668922D110669c9D88D0a`) was queried directly and returns a valid
`DOMAIN_SEPARATOR()`, a working `nonces()`, and the canonical EIP-2612 `PERMIT_TYPEHASH`
(`0x6e71edae12b1b97f4d1f60370fef10105fa2faae0126114a169c64845d6126c9`). The permit path is
therefore compatible with HSK mainnet.

`depositWithAuthorization()` adds the ERC-3009 `transferWithAuthorization` path the architecture
document describes. Both USDC contracts expose the canonical
`TRANSFER_WITH_AUTHORIZATION_TYPEHASH` (`0x7c7c6cdb…2267`). The signing/validation helper lives in
`packages/cctp-bridge/src/core/erc3009Signer.ts` and checks `validAfter` / `validBefore` and the
token's on-chain `authorizationState()` before submission.

Test evidence (`pnpm --filter @zip-0/contracts-evm test` → **12 passing**) covers a valid
authorization, an expired window, a not-yet-valid window, and a replayed nonce. The permit path is
unchanged and still passing.

**Not implemented:** the standalone `Erc3009Relayer.relayAuthorization()` still refuses to broadcast
(it verifies the signature, then throws `NotImplementedError`). The vault entry point performs the
on-chain transfer directly; the separate relayer broadcast remains future work.

### Typed SDK (`@zip-0/sdk`) and REST Gateway (`apps/gateway`)

Implemented under Phase 4 of the architectural roadmap:
- `packages/sdk`: typed `Zip0Client` exposing `payments.quote()`, `payments.create()`, `payments.get()`, and `webhooks.subscribe()`.
- `apps/gateway`: Express REST API running on `http://localhost:3000` (or `PORT`) exposing `POST /v1/payments/quote`, `POST /v1/payments/transfer`, `GET /v1/payments/:id`, `POST /v1/webhooks`, and `GET /health`.
- Test evidence: 5 Vitest unit tests in `packages/sdk` and 10 Vitest integration/e2e tests in `apps/gateway` verifying route estimation, payment transfer creation, status lookup, and webhook subscriptions.

---

## What is built but unproven

### Relayer orchestration

`packages/cctp-bridge/src/relayer/orchestrator.ts` is a facade over `PaymentRoutingEngine` +
`VaultSettlementRail`. Unit tests still use in-memory adapters (`test/bridge.test.ts`).

Local-chain evidence: `test/local-e2e.test.ts` starts a Hardhat node, deploys `MockUSDC` and
`ZIP0PaymentVault`, and drives a payment through the real `EvmAdapter`. It asserts on-chain
`PaymentInitiated` / `PaymentReleased` logs, a real vault USDC delta (deposit then release),
and a non-synthetic transaction hash. Stellar remains mocked (`IStellarAdapter.creditPayment`).

`pnpm --filter @zip-0/cctp-bridge test` is the command that runs this suite.

This is not a live testnet proof. Pollar / Horizon is still unproven.

### State durability

Payment tracking goes through `PaymentStore` (`get` / `set` / `list` / `findByStatus`).
`RelayerOrchestrator` receives the store by constructor injection and defaults to
`InMemoryPaymentStore` so existing unit tests keep an ephemeral `Map`.

Real runs can pass `FilePaymentStore`, a JSON file that reconstructs `bigint` amounts and
`Date` timestamps. The orchestrator writes `PROCESSING` before settlement and
`COMPLETED` or `FAILED` after, so a restart sees the last persisted transition.

Test evidence: `test/payment-store.test.ts` writes an intent, discards the store instance,
opens a new store on the same temp file, and reads the payment back — including a later
status update and an orchestrator-level COMPLETED recovery.

What this does **not** claim: crash-safe multi-process locking, ACID transactions, or
recovery of work that never reached `PaymentStore.set`. The router's in-process `Map` is
unchanged; durable recovery is the orchestrator's `getPaymentStatus` path.

---


### CCTP settlement rail

`packages/cctp-bridge/src/rails/cctp-settlement-rail.ts` implements `CctpSettlementRail` over
Circle's official Bridge Kit. `CircleBridgeKitClient` performs the full burn-and-mint:
approve USDC, `depositForBurn` on the source chain, poll Circle's Iris attestation (the kit owns
retry/backoff), then `receiveMessage` on the destination. `supportsRoute` returns true only where
**both** chains have CCTP — HashKey Chain and Stellar are deliberately excluded, so the router
falls back to the vault rail for them.

The rail returns the destination `mint` transaction hash from the Bridge Kit result. If the bridge
does not reach `success`, or no mint hash exists, it throws `CCTP_SETTLEMENT_FAILED` rather than
reporting a settlement that did not happen.

Test evidence: unit tests inject a fake `CctpBridgeClient` and cover route support, zero-fee
quoting, the returned mint hash, unconfigured refusal, recipient/amount validation, and error
propagation. **Not yet proven:** a live testnet burn-and-mint with real hashes (requires a funded
source-chain key).

### Settlement broadcast vs. verification

Two components implement correct cryptography but do **not** broadcast a transaction. They refuse
rather than return a hash, so no payment is ever marked settled without a real transaction behind
it.

| Component | Implemented | Not implemented |
| :--- | :--- | :--- |
| `Erc3009Relayer` | EIP-712 recovery, signer validation, nonce replay protection | `transferWithAuthorization` broadcast |
| `PollarPolygonAdapter` | Account/config surface | Sponsored transfer submission |

Both throw `NotImplementedError`. A test in `test/settlement-honesty.test.ts` scans `src/` and
fails if synthetic transaction-hash construction reappears.

This distinction matters: signature verification being real is a genuine milestone, and it is not
the same milestone as settlement working.


## What is designed but not built

These appear in `spec/Payment-Bridge-Architecture.md` in present tense but have no implementation.
A repository-wide search for each term returns zero matches outside the design document.

| Described | Reality |
| :--- | :--- |
| `@zip-0/sdk` | Package does not exist |
| REST API gateway (`/v1/payments/*`) | No `apps/` directory exists |

The root `package.json` `dev` script targets `--filter=backend --filter=web`. Neither workspace
exists, so `pnpm dev` cannot currently run.

---

## Privacy roadmap (designed, not built)

A ZK privacy model for KYC-gated institutional deposits is documented in
[`zk-privacy-model.md`](zk-privacy-model.md). A payer would prove, in zero knowledge, that it holds
a valid non-revoked KYC Soul Bound Token (`IKycSBT`) of sufficient tier, that the amount is within
that tier's limit, and that a nullifier has not been used — without revealing identity, amount, or
counterparty.

HSK can verify such a proof on-chain today: the `ecPairing` precompile at `0x08` returns `0x…01`
and the BLS12-381 precompiles are present, both probed directly against `https://mainnet.hsk.xyz`.

**This is a model only.** No circuit, verifier contract, nullifier registry, or vault entry point
exists, and `ZIP0PaymentVault` is unchanged. It should leave this section only once there is
running code and test evidence.

---

## Naming note

The package `@zip-0/cctp-bridge` now carries a real CCTP rail (`src/rails/cctp-settlement-rail.ts`),
so the name is accurate for EVM-to-EVM CCTP corridors. It also carries the vault rail and the
Stellar adapter, so the package is broader than CCTP alone.

---

## Trust model

The vault rail assumes an honest relayer. `releasePayment()` is callable by any `RELAYER_ROLE`
holder for any unused `paymentId`, any recipient, and any amount up to the vault balance, with no
on-chain verification of the corresponding Stellar-side credit.

This is a deliberate prototype tradeoff, not an oversight. The CCTP rail is the planned path to
trust-minimized settlement.
