# ZK Privacy Model for Institutional Payments

> **Status: design note, not implemented.** This document models how ZIP-0 could prove compliance
> on a cross-border USDC payment without revealing the client. No circuit is written, no verifier
> is deployed, and `ZIP0PaymentVault` is unchanged. If implemented later, it belongs in a separate
> issue and stays under "designed but not built" in [`project-status.md`](./project-status.md).

## Can HashKey Chain verify a ZK proof?

Verified by direct `eth_call` against `https://mainnet.hsk.xyz` (Chain ID `177`):

| Precompile | Probe | Result |
| :--- | :--- | :--- |
| `0x06` ecAdd (alt_bn128) | `0 + 0` (128 zero bytes) | 64 zero bytes — point at infinity |
| `0x08` **ecPairing** (alt_bn128) | empty input | `0x…01` — passes |
| `0x0b` BLS12-381 G1ADD (EIP-2537) | empty input | error `invalid input length` (present, validates input) |
| `0x1f` (control, no precompile) | empty input | `0x` — plain account, no code |

`ecPairing` is the precompile a Groth16 verifier calls, so an application-level verifier works on
HSK today. The BLS12-381 set arrived with the Jovian/Isthmus upgrade.

**Be precise:** HSK is an *optimistic* OP Stack rollup, not a ZK rollup. It does not use validity
proofs for its own security. What it does is *verify* application-level ZK proofs. "HSK is ZK" is
the wrong claim; "HSK can verify a ZK proof on-chain" is the accurate one.

## The model

### 1. Process using sensitive data

An institution sends a cross-border USDC payment through ZIP-0. Before the vault accepts the
deposit, compliance requires knowing the payer is a screened entity operating within its
authorised limits. Today the payer reveals who they are, so a competitor watching the chain learns
that Bank A moved money to Singapore on Tuesday.

### 2. What must stay private

- The payer's legal identity and jurisdiction
- Their KYC tier and the underlying documents
- The exact payment amount
- The counterparty being paid

### 3. What must be publicly verifiable

Three claims, none of which reveal the above:

1. The payer holds a **valid, non-revoked KYC credential of tier ≥ the required tier** for this
   corridor.
2. The payment amount is **within the limit** that tier authorises.
3. The credential has **not already been used** for this payment — replay protection via a
   nullifier.

The credential already exists on HSK: the `IKycSBT` Soul Bound Token (`requestKyc()`, `isHuman()`,
`getKycInfo()`) with tiers NONE / BASIC / ADVANCED / PREMIUM / ULTIMATE and statuses NONE /
APPROVED / REVOKED. The proof attests to that credential rather than inventing a new one — see
[`hsk-chain-integration.md`](./hsk-chain-integration.md).

### 4. Who proves, who verifies, what each party learns

```text
  ┌──────────────┐   holds KYC SBT (tier, status)
  │  INSTITUTION │   knows: identity, amount, tier, secret
  │   (Prover)   │
  └──────┬───────┘
         │  generates proof off-chain
         │  public inputs:  requiredTier, maxAmount, nullifier, sbtRoot
         │  private inputs: identity, actualTier, actualAmount, secret
         ▼
  ┌──────────────────────────────┐
  │  ZIP0PaymentVault (Verifier) │  on-chain, via ecPairing 0x08
  │  depositWithProof(...)       │
  └──────┬───────────────────────┘
         │  learns ONLY: "some approved entity of sufficient tier
         │               is depositing within its limit"
         ▼
  ┌──────────────┐
  │   RELAYER    │  learns: a valid deposit occurred. Not who, not how much.
  └──────┬───────┘
         ▼
  ┌───────────────┐
  │  REGULATOR    │  on lawful request, the institution opens the
  │  (out of band)│  commitment and reveals identity + amount.
  └───────────────┘  Privacy from the public, not from the regulator.
```

| Party | Learns |
| :--- | :--- |
| Institution (prover) | everything — it is their own data |
| Vault (verifier) | only that the three claims hold |
| Relayer | that a valid deposit happened |
| Public / competitors | nothing linking payer, amount, or counterparty |
| Regulator | full detail, on request, via the opened commitment |

The last row is what makes this institutional rather than anonymity for its own sake: **privacy
from the market, accountability to the regulator.**

### 5. Presentation

One page is enough: the diagram above plus the party/knowledge table. This is a modelling exercise,
not a build.

## How it would map onto ZIP-0 (future work, not started)

- A new vault entry point, e.g. `depositWithProof(...)`, taking the proof and the public inputs
  (`requiredTier`, `maxAmount`, `nullifier`, `sbtRoot`), plus the existing payment arguments.
- A Groth16 verifier contract called from that entry point via the `ecPairing` precompile, with a
  per-corridor verifying key.
- A nullifier registry so the same credential cannot fund the same payment twice.
- The existing `depositPayment` / `depositWithPermit` / `depositWithAuthorization` paths stay as
  they are; proving is opt-in per corridor, not a replacement.

## Open questions

- **Proof system:** Groth16 is the cheapest to verify on-chain (one `ecPairing` call), but needs a
  trusted setup; PLONK-style systems avoid it at a higher gas cost.
- **Credential root:** how `sbtRoot` is published and updated as the KYC SBT set changes.
- **Nullifier scope:** per payment, per corridor, or per epoch — this is a policy choice with a
  direct privacy/utility trade-off.
- **Regulator access:** commitment-opening mechanics and who holds the opening key.
