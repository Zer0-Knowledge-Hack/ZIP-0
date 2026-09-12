# Contributing to ZIP-0

Thanks for working on ZIP-0. This guide covers how to set up the workspace, the conventions we
follow, and how a change gets from your machine into `main`.

---

## Quick path

```bash
git clone https://github.com/Zer0-Knowledge-Hack/ZIP-0.git
cd ZIP-0
pnpm install
pnpm -r test
```

Expected result: 13 passing tests (8 contract, 5 relayer). No network access or `.env` required.

---

## Ground rules

| Rule | Detail |
| :--- | :--- |
| **pnpm only** | Never use `npm` or `yarn`. The lockfile and workspace linking depend on pnpm. |
| **Tests before code** | We follow TDD. Write the failing test, then make it pass. |
| **Lint before commit** | `pnpm lint` must be clean. |
| **Branch off `main`** | Never commit directly to `main`. |
| **Conventional commits** | See [Commit messages](#commit-messages). |
| **Honest documentation** | Never document a capability that does not exist. See below. |

### On honest documentation

This repository previously described unimplemented components in present tense, which is misleading
to reviewers and judges. `docs/project-status.md` is the authoritative record of what is built
versus designed.

If you add a feature, update that file. If you write about something planned, mark it as planned.

---

## Workspace layout

This is a pnpm workspace with two packages:

| Package | Purpose | Test runner |
| :--- | :--- | :--- |
| `@zip-0/contracts-evm` | Solidity contracts, deploy scripts | Hardhat |
| `@zip-0/cctp-bridge` | Relayer orchestrator, chain adapters | Vitest |

Run a single package's tests with `--filter`:

```bash
pnpm --filter @zip-0/contracts-evm test
pnpm --filter @zip-0/cctp-bridge test
```

---

## Common commands

```bash
pnpm install                  # install all workspace packages
pnpm -r test                  # every package's tests
pnpm -r build                 # build every package
pnpm lint                     # eslint across the workspace
pnpm node:local               # start a local Hardhat node
pnpm test:payment             # run the payment CLI script
pnpm clean                    # remove node_modules, dist, .next
```

---

## Environment configuration

Each package keeps its own `.env`, created from the committed example:

```bash
cp packages/contracts-evm/.env.example packages/contracts-evm/.env
cp packages/cctp-bridge/.env.example packages/cctp-bridge/.env
```

**Never commit a `.env` file or a private key.** `.gitignore` covers `.env`, `.env.*`, `*.pem`, and
`wallets`, but the ultimate safeguard is you. Use a throwaway deployer key for testnets.

**No literal-key fallbacks.** Never write `process.env.KEY || "0xabc..."`. A committed fallback in
a public repository is a published key, and it gets used silently the moment someone forgets to
set the variable. Make the program fail loudly instead — see `requireSecret()` in
`packages/cctp-bridge/scripts/test-payment-cli.ts` for the pattern.

Full rules in [SECURITY.md](SECURITY.md).

---

## Testing expectations

Local first, testnet second.

1. **Local.** All contract and relayer flows must pass against a local Hardhat node with `MockUSDC`
   before touching a live network.
2. **Testnet.** Then deploy to Avalanche Fuji (`43113`) or HashKey Chain Testnet (`133`).

Network parameters are in [`docs/hsk-chain-integration.md`](docs/hsk-chain-integration.md).

### A note on mocks

Several existing tests use in-memory mock adapters. Mocks are fine for unit tests, but a test named
`e2e` should touch a real chain. If you add integration coverage, make it genuinely integrated — and
do not name a mock-based test "e2e".

---

## Gotchas

**`typechain-types/` is committed to the repository.** Running `hardhat test` or `hardhat compile`
regenerates roughly 85 tracked files and dirties your working tree. Before committing:

```bash
git checkout -- packages/contracts-evm/typechain-types
```

Only commit changes there when the contract ABI genuinely changed.

**Legacy HSK RPC endpoints are dead.** If a HashKey deployment hangs, check the RPC URL before
assuming the network is down. Any `*.alt.technology` endpoint is decommissioned — use
`https://testnet.hsk.xyz` or `https://mainnet.hsk.xyz`.

---

## Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org/). Format:

```
<type>(<optional scope>): <description>

<optional body explaining why, not what>
```

Types in use: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `perf`.

Examples from this repository:

```
docs: add README as project entry point
feat: introduce HSK CCTP payment bridge with EVM contracts
chore: ignore local agent tooling artifacts
```

Keep the subject line under ~72 characters and in the imperative mood. Explain *why* in the body —
the diff already shows *what*.

Do not add AI attribution or `Co-Authored-By` trailers for tooling.

---

## Pull requests

1. Branch from `main`: `git checkout -b feat/your-change`
2. Make focused commits — one logical unit of work each.
3. Push and open a PR targeting `main`.
4. In the description, state **what to review first** and **what is out of scope**.

### Keep PRs reviewable

Aim for under 400 changed lines. If a change grows past that, split it into chained PRs and link
them to each other. A reviewer who has to reconstruct the whole story will miss real problems.

Separate behaviour changes from documentation changes. A PR that fixes a config value and rewrites
three docs is two PRs.

### PR checklist

- [ ] `pnpm -r test` passes
- [ ] `pnpm lint` is clean
- [ ] No `.env`, key, or secret in the diff
- [ ] `typechain-types/` noise reverted unless the ABI changed
- [ ] `docs/project-status.md` updated if capabilities changed
- [ ] Review path and out-of-scope items stated in the description

---

## Architecture decisions

Planning and delta specs follow the OpenSpec workflow under `openspec/changes/`. For substantial
changes, add a proposal there before implementing.

Reference documents:

- [`README.md`](README.md) — project entry point
- [`docs/project-status.md`](docs/project-status.md) — built versus designed
- [`docs/hsk-chain-integration.md`](docs/hsk-chain-integration.md) — verified HSK network reference
- [`spec/Payment-Bridge-Architecture.md`](spec/Payment-Bridge-Architecture.md) — target architecture
- [`AGENTS.md`](AGENTS.md) — tooling directives

---

## License

By contributing, you agree that your contributions will be licensed under the
[MIT License](LICENSE).
