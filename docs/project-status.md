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
| `ZIP0PaymentVault.sol` | ✅ Built, tested, deployed on Avalanche Fuji |
| EIP-2612 gasless deposit | ✅ Built and tested |
| Relayer orchestration (EVM ↔ Stellar) | ✅ Built; local Hardhat integration proven |
| Pollar / Stellar adapter | ⚠️ Built, no live-network test |
| Ports & Adapters core (ISettlementRail / PaymentRoutingEngine) | ✅ Built and tested |
| CCTP settlement rail | ❌ Not started |
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

Deployment evidence: the vault at `0xF1ca5572DC03f84aB0f2e5806df336264375e1Fa` on Avalanche Fuji
returns contract bytecode from `eth_getCode` and holds a non-zero USDC balance.

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

`packages/cctp-bridge/src/relayer/orchestrator.ts` is a facade over `PaymentRoutingEngine` +
`VaultSettlementRail`. Unit tests still use in-memory adapters (`test/bridge.test.ts`).

Local-chain evidence: `test/local-e2e.test.ts` starts a Hardhat node, deploys `MockUSDC` and
`ZIP0PaymentVault`, and drives a payment through the real `EvmAdapter`. It asserts on-chain
`PaymentInitiated` / `PaymentReleased` logs, a real vault USDC delta (deposit then release),
and a non-synthetic transaction hash. Stellar remains mocked (`IStellarAdapter.creditPayment`).

`pnpm --filter @zip-0/cctp-bridge test` is the command that runs this suite.

This is not a live testnet proof. Pollar / Horizon is still unproven.

### State durability

`RelayerOrchestrator` holds payment state in an in-memory `Map`. A process restart loses tracking
of every in-flight payment. Acceptable for a demo; not acceptable for settlement.

---


### Settlement broadcast vs. verification

Three components implement correct cryptography and routing but do **not** broadcast a
transaction. They refuse rather than return a hash, so no payment is ever marked settled without
a real transaction behind it.

| Component | Implemented | Not implemented |
| :--- | :--- | :--- |
| `CctpSettlementRail` | Circle domain map, route support, fee quote | `depositForBurn`, Iris attestation, `receiveMessage` |
| `Erc3009Relayer` | EIP-712 recovery, signer validation, nonce replay protection | `transferWithAuthorization` broadcast |
| `PollarPolygonAdapter` | Account/config surface | Sponsored transfer submission |

All three throw `NotImplementedError`. A test in `test/settlement-honesty.test.ts` scans `src/`
and fails if synthetic transaction-hash construction reappears.

This distinction matters: signature verification being real is a genuine milestone, and it is not
the same milestone as settlement working.


## What is designed but not built

These appear in `spec/Payment-Bridge-Architecture.md` in present tense but have no implementation.
A repository-wide search for each term returns zero matches outside the design document.

| Described | Reality |
| :--- | :--- |
| `CctpSettlementRail`, Circle `TokenMessenger`, Iris attestation | No CCTP code exists anywhere in the repository |
| `@zip-0/sdk` | Package does not exist |
| REST API gateway (`/v1/payments/*`) | No `apps/` directory exists |

The root `package.json` `dev` script targets `--filter=backend --filter=web`. Neither workspace
exists, so `pnpm dev` cannot currently run.

---

## Naming note

The package `@zip-0/cctp-bridge` and the branch `feat/cctp` both reference CCTP, but no CCTP
integration is implemented. The name reflects intended direction, not current capability. Renaming
is deferred to avoid churn during the hackathon.

---

## Trust model

The vault rail assumes an honest relayer. `releasePayment()` is callable by any `RELAYER_ROLE`
holder for any unused `paymentId`, any recipient, and any amount up to the vault balance, with no
on-chain verification of the corresponding Stellar-side credit.

This is a deliberate prototype tradeoff, not an oversight. The CCTP rail is the planned path to
trust-minimized settlement.
