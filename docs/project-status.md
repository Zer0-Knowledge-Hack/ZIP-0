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
| Relayer orchestration (EVM ↔ Stellar) | ⚠️ Built, tested against mocks only |
| Pollar / Stellar adapter | ⚠️ Built, no live-network test |
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

## What is designed but not built

These appear in `spec/Payment-Bridge-Architecture.md` in present tense but have no implementation.
A repository-wide search for each term returns zero matches outside the design document.

| Described | Reality |
| :--- | :--- |
| `ISettlementRail`, `IPaymentRouter`, `PaymentRoutingEngine` | `core/interfaces.ts` actually defines `IEvmAdapter`, `IStellarAdapter`, `IRelayerOrchestrator` |
| `PaymentIntent.railType`, `SettlementRailType` | `PaymentIntent` has no `railType` field |
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
