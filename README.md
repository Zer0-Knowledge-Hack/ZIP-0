# ZIP-0 — Cross-Border USDC Settlement Rails

ZIP-0 is payment infrastructure for institutional cross-border settlement in USDC. It lets an
institution send value between an EVM chain and Stellar without holding native gas tokens, without
a pool-based AMM, and without touching SWIFT.

This repository contains the on-chain settlement vault, the off-chain relayer that moves a payment
between chains, a REST gateway, a typed SDK, and the web app an institution uses to send one.

**Live app: [zip-0.pages.dev](https://zip-0.pages.dev/)** — the available-funds figure and the chain
height are read from the deployed HashKey Chain Testnet vault. Payment submission is deliberately
disabled; [Web app](#web-app) states exactly which surfaces are live.

**Demo: [The amount you send is the amount that arrives](https://youtu.be/yX7G3O1c4tg)** — a
three-minute walkthrough of the problem, the settlement rail, and the deployed contract. The
spoken script is in [docs/pitch-script.md](docs/pitch-script.md).

> **Status: hackathon-stage prototype.** The settlement vault is implemented, tested, and deployed
> on a live testnet. The relayer orchestration is implemented and unit-tested against mocks.
> Several components described in the architecture document are still planned, not built —
> see [Project Status](docs/project-status.md) for an exact, line-by-line breakdown of what
> exists today versus what is designed.

---

## Quick path

```bash
pnpm install                                  # install the workspace (5 packages)
pnpm --filter @zip-0/contracts-evm test       # 23 contract tests
pnpm --filter @zip-0/cctp-bridge test         # 63 relayer tests
pnpm -r test                                  # every suite
```

Expected result: 120 passing tests (23 contracts, 63 relayer, 19 web, 10 gateway, 5 SDK), with no
configuration or network access required.

To deploy the vault to a live network:

```bash
cp packages/contracts-evm/.env.example packages/contracts-evm/.env   # add PRIVATE_KEY
pnpm --filter @zip-0/contracts-evm deploy:hsk-testnet                # HashKey Chain Testnet
pnpm --filter @zip-0/contracts-evm deploy:avax-fuji                  # Avalanche Fuji
```

See [HSK Chain Integration](docs/hsk-chain-integration.md) for network parameters, gas costs, and
the mainnet deployment path.

---

## How it works

ZIP-0 routes a payment over one of two settlement rails:

| Rail | Mechanism | Liquidity | Status |
| :--- | :--- | :--- | :--- |
| **Vault rail** | Lock USDC in a vault on the source chain, release from the vault on the destination chain via an authorized relayer | Bounded by vault float | **Implemented** |
| **CCTP rail** | Circle burn-and-mint, 1:1, no pools | Unbounded | **Implemented and proven** (live Fuji → Arbitrum Sepolia transfer) |

Vault-rail payments settle today. CCTP corridors between Circle-supported EVM chains are
implemented and routed automatically, and a live testnet burn-and-mint has completed end to end —
see the "CCTP settlement rail" section of [Project Status](docs/project-status.md) for the
transaction hashes.

```text
  EVM chain (HSK / Avalanche)                      Stellar (Pollar)
  ───────────────────────────                      ────────────────
   ZIP0PaymentVault
      depositPayment()  ──── PaymentInitiated ───▶ RelayerOrchestrator
      depositWithPermit()                                  │
                                                           ▼
                                                    creditPayment()
                                                           │
      releasePayment()  ◀──── relayer credits ─────────────┘
```

### Gasless deposits

`depositWithPermit()` accepts an EIP-2612 `permit` signature, so a payer authorizes and deposits in
a single transaction without pre-approving the vault. This is verified to work against HashKey
Chain's bridged USDC, which implements EIP-2612.

`depositWithAuthorization()` accepts an ERC-3009 `transferWithAuthorization` signature instead. The
token — not the vault — enforces the signature, so no allowance is involved, and authorizations are
time-bounded (`validAfter` / `validBefore`) with random nonces. That lets several authorizations be
issued and settle out of order, which sequential `permit` nonces cannot do. Both Circle's native
USDC (Avalanche) and HashKey's bridged USDC.e expose ERC-3009.

### Trust model — read this before evaluating

The vault rail is **not trust-minimized**. An address holding `RELAYER_ROLE` can call
`releasePayment()` for any unused `paymentId`, to any recipient, for any amount up to the vault's
balance. There is no on-chain proof of the Stellar-side credit.

In other words, ZIP-0 currently assumes an honest relayer. Making settlement trust-minimized is
what the CCTP rail is for: it settles 1:1 through Circle with no trusted operator in the middle.
We state the vault rail's limits explicitly rather than implying guarantees the code does not
provide.

---

## Repository layout

| Path | Contents |
| :--- | :--- |
| `packages/contracts-evm` | `ZIP0PaymentVault.sol`, `MockUSDC.sol`, Hardhat config, deploy scripts |
| `packages/cctp-bridge` | Relayer orchestrator, EVM/Stellar adapters, core types |
| `packages/sdk` | `@zip-0/sdk` typed client library (`Zip0Client`) |
| `apps/gateway` | REST API gateway exposing `/v1/payments/*` endpoints |
| `apps/web` | React web app (landing, payment shell, legal disclosure), deployed at [zip-0.pages.dev](https://zip-0.pages.dev/) |
| `spec/` | Architecture reference (design intent, includes planned work) |
| `docs/` | Operational documentation (verified facts, integration guides) |
| `openspec/` | OpenSpec change tracking |

---

## SDK & REST Gateway

ZIP-0 provides both a typed client SDK (`@zip-0/sdk`) and an HTTP REST gateway (`apps/gateway`) allowing applications to initiate and track payments without managing low-level contract calls directly.

### Running the Gateway

```bash
pnpm dev
# Or run gateway directly:
pnpm --filter @zip-0/gateway dev
```

The gateway runs by default at `http://localhost:3000` and exposes:

- `GET /health` — Service health check
- `POST /v1/payments/quote` — Route evaluation, fee calculation, and rail selection
- `POST /v1/payments/transfer` — Payment initiation
- `GET /v1/payments/:id` — Payment status lookup and transaction hashes
- `POST /v1/webhooks` — Webhook event subscription

### Using `@zip-0/sdk`

```typescript
import { Zip0Client } from "@zip-0/sdk";

const zip0 = new Zip0Client({
  baseUrl: "http://localhost:3000",
  apiKey: process.env.ZIP0_API_KEY,
});

// 1. Get a quote
const quote = await zip0.payments.quote({
  sourceChain: "avalanche",
  destinationChain: "hashkey",
  amount: "5000000.00",
});
console.log(`Estimated fee: ${quote.estimatedFee} USDC, Rail: ${quote.railType}`);

// 2. Initiate payment
const payment = await zip0.payments.create({
  amount: "5000000.00",
  sourceChain: "avalanche",
  destinationChain: "hashkey",
  recipient: "0xRecipientAddress...",
  reference: "INV-2026-SG-001",
});
console.log(`Payment initiated: ${payment.paymentId}, Tx: ${payment.destinationTxHash}`);

// 3. Track settlement status
const status = await zip0.payments.get(payment.paymentId);
console.log(`Current status: ${status.status}`);
```

---

## Web app

`apps/web` is a React 19 + Vite single-page app deployed to Cloudflare Pages at
[zip-0.pages.dev](https://zip-0.pages.dev/). It ships English and Spanish copy and routes between a
marketing landing page (`/`), the product shell (`/app`, `/app/pay`, `/app/activity`), and a legal
disclosure page (`/legal`).

```bash
pnpm --filter @zip-0/web dev      # http://127.0.0.1:5173
pnpm --filter @zip-0/web build
```

What is live and what is not — the same rule the rest of this repository follows:

| Surface | Status |
| :--- | :--- |
| Available funds on the overview | **Live.** Read from the HSK Testnet vault via viem, polled every 15 s |
| Chain height in the legal disclosure | **Live.** Same read |
| Vault link | **Live.** Points at the verified contract |
| Payment submission | **Disabled.** The confirm button does not send a transaction |
| Activity and history | **Empty.** No read integration yet, and no placeholder rows |

No screen in the app displays a balance, a hash, or a settled status that did not come from a real
chain read; when the RPC is unreachable the figure renders as explicitly unavailable rather than as
zero. Uploaded invoice PDFs never leave the browser — only their Keccak-256 fingerprint is held in
component state. See [apps/web/README.md](apps/web/README.md) for the read surface and known gaps.

---

## Contract reference — `ZIP0PaymentVault`

Solidity `>=0.8.20 <0.9.0`, compiled at `0.8.24` with `evmVersion: cancun`, optimizer 200 runs.
Built on OpenZeppelin `AccessControl`, `ReentrancyGuard`, and `SafeERC20`.

| Function | Access | Purpose |
| :--- | :--- | :--- |
| `depositPayment` | public | Lock USDC and emit `PaymentInitiated` |
| `depositWithPermit` | public | Same, using an EIP-2612 signature (no prior approve) |
| `depositWithAuthorization` | public | Same, using an ERC-3009 `transferWithAuthorization` signature (no allowance) |
| `releasePayment` | `RELAYER_ROLE` | Release USDC to a recipient on this chain |
| `refundPayment` | `RELAYER_ROLE` | Return an initiated or acknowledged payment to its payer |
| `acknowledgePayment` | `RELAYER_ROLE` | Mark a deposit as picked up before settling it, which blocks `claimRefund` |
| `claimRefund` | payer | Recover a deposit the relayer never acknowledged, after `REFUND_TIMEOUT` (24 h) |
| `rebalanceVault` | `TREASURY_ROLE` | Move float out of the vault for rebalancing |

Roles: `DEFAULT_ADMIN_ROLE`, `TREASURY_ROLE` (granted to admin at construction), `RELAYER_ROLE`.

Amounts use 6 decimals, matching USDC on every supported network.

**Known limitations.** Once the relayer acknowledges a deposit, only the relayer can refund it.
The relayer acknowledges every EVM → Stellar deposit before crediting Stellar, so relayer downtime
The legacy Avalanche Fuji vault (`0xF1ca…`) and the original HSK Testnet vault from #3 (`0x14e5…`)
predate `acknowledgePayment` and `claimRefund`. The active Avalanche Fuji vault (`0x9B9D238D3b7dfAdF87b6096889fcE2fe39d76f50`, verified on Snowtrace)
and the active HSK Testnet vault (`0x3028…`) both implement full refund and acknowledgement support matching this repository.
Relayer payment state lives in an in-memory `Map` and does not survive a process restart.

---

## Networks

| Network | Chain ID | Role | Status |
| :--- | :--- | :--- | :--- |
| Avalanche Fuji | `43113` | Primary EVM testbed | Vault deployed |
| HashKey Chain Testnet | `133` | Symmetric EVM rail | Vault deployed |
| HashKey Chain Mainnet | `177` | Symmetric EVM rail | Ready to deploy |
| Hardhat local | `31337` | CI and unit tests | Supported |
| Stellar Testnet | — | Pollar corridor | Adapter implemented |

### Deployed contracts

**Avalanche Fuji (`43113`)**

| Contract | Address |
| :--- | :--- |
| `ZIP0PaymentVault` | [`0x9B9D238D3b7dfAdF87b6096889fcE2fe39d76f50`](https://testnet.snowtrace.io/address/0x9B9D238D3b7dfAdF87b6096889fcE2fe39d76f50#code) |
| Circle USDC (Fuji) | `0x5425890298aed601595a70ab815c96711a31bc65` |

**HashKey Chain Testnet (`133`)**

| Contract | Address |
| :--- | :--- |
| `ZIP0PaymentVault` | [`0x3028a9AfCD5E2c3C2E1fD35d984Be65640ca4e07`](https://testnet-explorer.hsk.xyz/address/0x3028a9AfCD5E2c3C2E1fD35d984Be65640ca4e07) |
| `MockUSDC` | [`0x1f65E72EE31F709969Dfc75f98f5867EaE332CD9`](https://testnet-explorer.hsk.xyz/address/0x1f65E72EE31F709969Dfc75f98f5867EaE332CD9) |

The #3 submission vault [`0x14e59806054773fc341377aEC472C07e500BCc86`](https://testnet-explorer.hsk.xyz/address/0x14e59806054773fc341377aEC472C07e500BCc86) is still on-chain. It does not implement `acknowledgePayment`. Do not point the live runner at it.

### Live HSK testnet demo

`packages/cctp-bridge/scripts/test-payment-cli.ts` defaults to HashKey Chain Testnet (`133`) and the
`0x3028…` vault. Flow 1 calls `releasePayment`; Flow 2 calls `depositPayment` then the relayer's
`acknowledgePayment` before crediting Stellar.

```bash
# packages/cctp-bridge/.env  — keys only; network defaults to HSK testnet
RELAYER_PRIVATE_KEY=0x...   # must hold RELAYER_ROLE on 0x3028…
ALICE_PRIVATE_KEY=0x...     # must hold MockUSDC and a little HSK for gas
```

```bash
pnpm --filter @zip-0/cctp-bridge test:payment
```

Explorer links print as `https://testnet-explorer.hsk.xyz/tx/<hash>`. To force Avalanche Fuji
instead, set `EVM_CHAIN_ID=43113` (Flow 2 will fail there until that vault is redeployed).

### Recorded run — 2026-09-13

Both flows executed against the live deployment. Every hash below was confirmed on-chain by
transaction receipt before being written here.

**Flow 1 — Stellar → HashKey Chain** (relayer releases 0.25 MockUSDC to the merchant)

| Step | Transaction |
| :--- | :--- |
| Stellar registration | [`d4a121b6…c6fb`](https://stellar.expert/explorer/testnet/tx/d4a121b6acc8654bdc3d5ccfd40b6ed63d2f2b90fb3a5141dbd0e28e9ef1c6fb) — ledger 4 651 194 |
| `releasePayment` | [`0xcd298ce6…aab1`](https://testnet-explorer.hsk.xyz/tx/0xcd298ce61d6a6e5c89e6aba2254f565f2b36e0071cc2e56d41957e2c4604aab1) — block 33 046 453 |

Merchant balance moved 0.25 → 0.50 MockUSDC.

**Flow 2 — HashKey Chain → Stellar** (payer deposits 0.10 MockUSDC, relayer acknowledges, then credits Stellar)

| Step | Transaction |
| :--- | :--- |
| `approve` | [`0x1097ca7e…1464`](https://testnet-explorer.hsk.xyz/tx/0x1097ca7e3b3da2ca23f0c5b499ca90f5387156c1ac5d46865aa0382512ac1464) — block 33 046 455 |
| `depositPayment` | [`0x80c6cd7e…f9ec`](https://testnet-explorer.hsk.xyz/tx/0x80c6cd7ecb7e3f39ebadb70312ce522b3334b6142ed387eea54f178d7e71f9ec) — block 33 046 456 |
| Stellar credit | [`7e3a7b77…e7a5`](https://stellar.expert/explorer/testnet/tx/7e3a7b77af4d6dfb18b129b0655afa64b8583bd5450b8a843705345c0bf5e7a5) — ledger 4 651 198 |

Flow 2 exercises `acknowledgePayment` before crediting Stellar, which is the ordering that keeps
`claimRefund` from being reachable on a payment that already settled.

> **Known issue.** The script sends `approve` and `depositPayment` without waiting for the
> approve receipt, so a first run against a fresh payer reverts with
> `ERC20InsufficientAllowance`. The allowance lands regardless, so an immediate re-run succeeds.
> The fix is to await the approve receipt — tracked separately.

---

## Development

This workspace uses **pnpm** exclusively. Do not use npm or yarn.

```bash
pnpm install              # install all workspace packages
pnpm -r test              # run every package's test suite
pnpm lint                 # eslint across the workspace
pnpm node:local           # start a local Hardhat node
```

Contracts are tested with Hardhat; TypeScript is tested with Vitest.

---

## Roadmap

1. Deploy the vault to HashKey Chain mainnet and settle a real payment end to end.
2. Replace mock-based relayer tests with integration tests against a live chain.
3. Persist relayer payment state so it survives restarts.
4. ~~Record a live CCTP testnet transfer.~~ Done: a Fuji → Arbitrum Sepolia burn-and-mint completed
   end to end (hashes in [Project Status](docs/project-status.md)).
5. ~~Package `@zip-0/sdk` and a REST gateway so institutions integrate without touching chain code.~~
   Done: `packages/sdk` and `apps/gateway` ship in this repository.
6. Wire the web app's payment submission to the gateway, and back the activity view with real reads.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for workspace setup, testing expectations, commit
conventions, and the pull request process.

Short version: pnpm only, tests before code, branch off `main`, conventional commits, and never
document a capability that does not exist.

## License

[MIT](LICENSE) © 2026 Zer0-Knowledge-Hack
