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
| Relayer orchestration (EVM ↔ Stellar) | ⚠️ Built, tested against mocks only |
| Pollar / Stellar adapter | ⚠️ Built, no live-network test |
| Ports & Adapters core (ISettlementRail / PaymentRoutingEngine) | ✅ Built and tested |
| CCTP settlement rail | ⚠️ Built (Circle Bridge Kit); live testnet transfer not yet recorded |
| ERC-3009 `transferWithAuthorization` | ❌ Not started |
| `@zip-0/sdk` package | ❌ Not started |
| REST API gateway | ❌ Not started |
| Persistent payment state | ❌ Not started |

---

## What is built and proven

### Settlement vault

`packages/contracts-evm/contracts/ZIP0PaymentVault.sol` — 226 lines. Lock/release vault with
`AccessControl`, `ReentrancyGuard`, and `SafeERC20`.

Test evidence: `pnpm --filter @zip-0/contracts-evm test` → **8 passing**, covering initialization
and roles, deposit with event emission, duplicate-`paymentId` rejection, permit-based deposit,
relayer release, non-relayer rejection, insufficient-liquidity rejection, and treasury rebalance.

Deployment evidence:
- Avalanche Fuji (`43113`): `0xF1ca5572DC03f84aB0f2e5806df336264375e1Fa` returns contract bytecode from `eth_getCode` and holds a non-zero USDC balance.
- HashKey Chain Testnet (`133`): `0x14e59806054773fc341377aEC472C07e500BCc86` (pointing to MockUSDC at `0x46a7BE8Cea2d9EB017D0a0277467E680bcA04f17`), verified on-chain runtime bytecode (5,228 bytes) with 50,000 MockUSDC initial liquidity.

Bytecode size: 5,966 bytes init / 5,228 bytes deployed — comfortably under the EIP-170 24 KB limit.


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

Note this uses **EIP-2612 permit**, not ERC-3009 `transferWithAuthorization`. The architecture
document describes the latter; the code implements the former.

---

## What is built but unproven

### Relayer orchestration

`packages/cctp-bridge/src/relayer/orchestrator.ts` — 126 lines implementing both directions
(EVM → Stellar, Stellar → EVM), liquidity checks, and status transitions.

Test evidence: `pnpm --filter @zip-0/cctp-bridge test` → **5 passing**.

**The gap:** `test/local-e2e.test.ts` is named "E2E" but constructs in-memory mock adapters. Its
own comment reads *"In-memory simulation of local Hardhat node contract."* It runs in ~7 ms and
never contacts a chain. `test/bridge.test.ts` is likewise mock-driven.

There is currently **no evidence that the relayer works against a real chain.** Closing this gap
is roadmap item 2 and the highest-value next step.

### State durability

`RelayerOrchestrator` holds payment state in an in-memory `Map`. A process restart loses tracking
of every in-flight payment. Acceptable for a demo; not acceptable for settlement.

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
