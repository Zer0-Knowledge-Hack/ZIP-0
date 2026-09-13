# ZIP-0 web

Landing page and product shell for ZIP-0. Uses the Modern Rail identity and design tokens from #37.

```sh
pnpm --filter @zip-0/web dev
pnpm --filter @zip-0/web build
pnpm --filter @zip-0/web test
```

`pnpm dev` from the repository root starts this app alongside the gateway.

## Deployment (Cloudflare Pages)

This is a pnpm workspace, so the defaults Cloudflare suggests for a Vite project are wrong: they
build from the repository root and look for `dist` there, which does not exist.

| Setting | Value |
| --- | --- |
| Framework preset | React (Vite) — only prefills the fields below |
| Build command | `pnpm --filter @zip-0/web build` |
| Build output directory | `apps/web/dist` |
| Root directory | *leave empty* (the repository root) |

Root directory stays empty on purpose. pnpm resolves the workspace from the root lockfile, so
pointing Cloudflare at `apps/web` breaks dependency resolution.

Node and pnpm versions are pinned in the repository — `.node-version` and the `packageManager`
field in the root `package.json` — rather than configured in the dashboard, so a local build and a
deployed build use the same toolchain. If the build image ignores `packageManager`, set a
`PNPM_VERSION` environment variable to match.

### Why `public/_redirects` exists

A single-page app has no server-side routes. Without a fallback, every path except `/` returns 404
on a reload or a shared link — including `/legal`, which the landing footer links to.

```
/*    /index.html   200
```

Cloudflare serves the file when one exists and falls back to the shell otherwise. This makes
`pageFromPath` the only thing deciding what a visitor sees on a deep link, which is why
`routes.test.ts` covers every published path.

`public/_headers` sets `nosniff`, `DENY` framing and a strict referrer policy, and caches hashed
assets hard while keeping `index.html` uncached — otherwise a deploy strands visitors on a stale
shell pointing at assets that no longer exist.

## What is real and what is not

This distinction is the point, so it is stated first.

| Element | Status |
| --- | --- |
| Available funds on the overview | **Live.** Read from the deployed vault on HashKey Chain Testnet, polled every 15s |
| Chain height in the legal disclosure | **Live.** Same read |
| Vault link | **Live.** Points at the verified contract source |
| Payment submission | **Disabled.** The confirm button does not send |
| Activity and history | **Empty.** No read integration yet, and no placeholder rows |

There is no path in this app that displays a transaction hash, a balance, or a settled status that
did not come from a real chain read. When the RPC is unreachable the figure is replaced with an
explicit unavailable state — never a cached or default number. Three fabricated transaction hashes
were removed from this repository earlier in its history; reintroducing that pattern in the UI,
where it is far more visible, would be worse.

## Chain reads

`src/chain.ts` holds the entire read surface: a viem public client pinned to chain `133` on
`https://testnet.hsk.xyz`, plus pure formatters that are unit-tested without a network.

Reads are issued as a pair and both must succeed. A block height rendered next to a missing balance
would invite the reader to assume the balance is zero rather than unknown.

Amounts truncate rather than round: overstating available funds is the direction that misleads
someone deciding whether a payment will settle.

## Wallet

Connection requests public accounts only. The network selector labels the route; it does not switch
the wallet's network. Uploaded PDFs never leave the browser — only their Keccak-256 fingerprint is
held in component state, and it is not submitted anywhere.

## Known gaps

- Recipient input is validated as Stellar StrKey shape, not checksum.
- `ACKNOWLEDGED` is not proof of destination settlement; source and destination need separate
  tracking before any status is shown as complete.
- Do not infer ERC-3009 support from `REFUND_TIMEOUT` alone — those capabilities shipped in
  separate contract releases.
