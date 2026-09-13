# ZIP-0 — Cross-Border USDC Settlement Rails

ZIP-0 is payment infrastructure for institutional cross-border settlement in USDC. It lets an
institution send value between an EVM chain and Stellar without holding native gas tokens, without
a pool-based AMM, and without touching SWIFT.

This repository contains the on-chain settlement vault and the off-chain relayer that moves a
payment between chains.

> **Status: hackathon-stage prototype.** The settlement vault is implemented, tested, and deployed
> on a live testnet. The relayer orchestration is implemented and unit-tested against mocks.
> Several components described in the architecture document are still planned, not built —
> see [Project Status](docs/project-status.md) for an exact, line-by-line breakdown of what
> exists today versus what is designed.

---

## Quick path

```bash
pnpm install                                  # install workspace (3 packages)
pnpm --filter @zip-0/contracts-evm test       # 8 contract tests
pnpm --filter @zip-0/cctp-bridge test         # 5 relayer tests
```

Expected result: 13 passing tests, no configuration or network access required.

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
| **CCTP rail** | Circle burn-and-mint, 1:1, no pools | Unbounded | **Planned** — no code yet |

Today every payment settles over the vault rail.

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

### Trust model — read this before evaluating

The vault rail is **not trust-minimized**. An address holding `RELAYER_ROLE` can call
`releasePayment()` for any unused `paymentId`, to any recipient, for any amount up to the vault's
balance. There is no on-chain proof of the Stellar-side credit.

In other words, ZIP-0 currently assumes an honest relayer. Making settlement trust-minimized is
what the planned CCTP rail is for. We state this explicitly rather than implying guarantees the
code does not provide.

---

## Repository layout

| Path | Contents |
| :--- | :--- |
| `packages/contracts-evm` | `ZIP0PaymentVault.sol`, `MockUSDC.sol`, Hardhat config, deploy scripts |
| `packages/cctp-bridge` | Relayer orchestrator, EVM/Stellar adapters, core types |
| `spec/` | Architecture reference (design intent, includes planned work) |
| `docs/` | Operational documentation (verified facts, integration guides) |
| `openspec/` | OpenSpec change tracking |

---

## Contract reference — `ZIP0PaymentVault`

Solidity `>=0.8.20 <0.9.0`, compiled at `0.8.24` with `evmVersion: cancun`, optimizer 200 runs.
Built on OpenZeppelin `AccessControl`, `ReentrancyGuard`, and `SafeERC20`.

| Function | Access | Purpose |
| :--- | :--- | :--- |
| `depositPayment` | public | Lock USDC and emit `PaymentInitiated` |
| `depositWithPermit` | public | Same, using an EIP-2612 signature (no prior approve) |
| `releasePayment` | `RELAYER_ROLE` | Release USDC to a recipient on this chain |
| `refundPayment` | `RELAYER_ROLE` | Return an initiated payment to its payer |
| `rebalanceVault` | `TREASURY_ROLE` | Move float out of the vault for rebalancing |

Roles: `DEFAULT_ADMIN_ROLE`, `TREASURY_ROLE` (granted to admin at construction), `RELAYER_ROLE`.

Amounts use 6 decimals, matching USDC on every supported network.

**Known limitations.** `refundPayment` is relayer-only — a payer cannot self-refund after a
timeout. Relayer payment state lives in an in-memory `Map` and does not survive a process restart.

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
| `ZIP0PaymentVault` | [`0xF1ca5572DC03f84aB0f2e5806df336264375e1Fa`](https://testnet.snowtrace.io/address/0xF1ca5572DC03f84aB0f2e5806df336264375e1Fa) |
| Circle USDC (Fuji) | `0x5425890298aed601595a70ab815c96711a31bc65` |

**HashKey Chain Testnet (`133`)**

| Contract | Address |
| :--- | :--- |
| `ZIP0PaymentVault` | [`0x14e59806054773fc341377aEC472C07e500BCc86`](https://testnet-explorer.hsk.xyz/address/0x14e59806054773fc341377aEC472C07e500BCc86) |
| `MockUSDC` | [`0x46a7BE8Cea2d9EB017D0a0277467E680bcA04f17`](https://testnet-explorer.hsk.xyz/address/0x46a7BE8Cea2d9EB017D0a0277467E680bcA04f17) |

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
4. Implement the CCTP rail (Circle `TokenMessenger` + Iris attestation) to remove relayer trust.
5. Package `@zip-0/sdk` and a REST gateway so institutions integrate without touching chain code.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for workspace setup, testing expectations, commit
conventions, and the pull request process.

Short version: pnpm only, tests before code, branch off `main`, conventional commits, and never
document a capability that does not exist.

## License

[MIT](LICENSE) © 2026 Zer0-Knowledge-Hack
