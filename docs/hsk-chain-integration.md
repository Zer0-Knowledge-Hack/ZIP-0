# HashKey Chain (HSK) Integration Guide

Everything ZIP-0 needs to deploy and operate on HashKey Chain. Network values in this document were
verified by direct RPC calls, and costs were measured on-chain rather than estimated.

**Verified on:** 2026-09-12.

---

## Quick path

1. Point Hardhat at the correct RPC (see [Network parameters](#network-parameters)).
2. Fund the deployer: faucet for testnet, ~5 HSK for mainnet.
3. Deploy: `pnpm --filter @zip-0/contracts-evm deploy:hsk-testnet`.
4. Verify the contract on Blockscout.

---

## Read this first: the stale RPC trap

HashKey migrated its public RPC endpoints from `alt.technology` to `hsk.xyz`. The old endpoints are
**decommissioned and return no response**, and stale references still appear in HashKey's own
documentation (the KYC tools page cites `hk-testnet.rpc.alt.technology`, which is dead).

| Endpoint | Result |
| :--- | :--- |
| `https://testnet.hsk.xyz` | ✅ `eth_chainId` → `0x85` (133) |
| `https://mainnet.hsk.xyz` | ✅ `eth_chainId` → `0xb1` (177) |
| `https://hashkeychain-testnet.alt.technology` | ❌ no response |
| `https://hk-testnet.rpc.alt.technology` | ❌ no response |

If a deployment to HSK hangs or times out, check the RPC URL before assuming the network is down.
HSK Chain testnet and mainnet are both live and producing blocks.

---

## Network parameters

| | Mainnet | Testnet |
| :--- | :--- | :--- |
| Chain ID | `177` | `133` |
| RPC | `https://mainnet.hsk.xyz` | `https://testnet.hsk.xyz` |
| Explorer | `https://hashkey.blockscout.com` | `https://testnet-explorer.hsk.xyz` |
| Alt. explorer | `https://www.oklink.com/zh-hans/hashkey` | — |
| Native token | HSK | HSK (test) |

Hardhat configuration:

```ts
hskMainnet: {
  url: process.env.HSK_MAINNET_RPC_URL || "https://mainnet.hsk.xyz",
  chainId: 177,
  accounts: [PRIVATE_KEY],
},
hskTestnet: {
  url: process.env.HSK_RPC_URL || "https://testnet.hsk.xyz",
  chainId: 133,
  accounts: [PRIVATE_KEY],
},
```

---

## Funding the deployer

### Testnet

Use the faucet at `https://faucet.hsk.xyz/faucet` (testnet only). Alternatively, acquire Sepolia ETH
and bridge via `https://testnet-bridge.hashkeychain.net/`.

### Mainnet

There is no mainnet faucet. Two options:

1. **Buy HSK on an exchange and withdraw directly to HashKey Chain.** HSK is listed on major
   exchanges. This is the cheaper path.
2. **Bridge from Ethereum L1** via Superbridge (`https://bridge.hashkeychain.net`) or Orbiter
   Finance. Note that L1 gas for the bridge transaction typically costs more than the HSK you need.

HSK on Ethereum L1: `0xE7C6BF469e97eEB0bFB74C8dbFF5BD47D4C1C98a`.

---

## Deployment cost (measured)

HSK Chain is an OP Stack L2, so a transaction pays an L2 execution fee plus an L1 data
availability fee.

Measured against `ZIP0PaymentVault`'s real 5,966-byte init bytecode:

| Component | Value |
| :--- | :--- |
| L2 gas price (mainnet) | 500.001 gwei |
| L2 gas price (testnet) | 1.001 gwei |
| L1 data fee for this deployment | 0.0000798 HSK |
| **Total mainnet deployment** | **~1.25–1.75 HSK** |
| Simple transaction (~100k gas) | ~0.05 HSK |

The L1 component is roughly 0.006% of the total, so mainnet cost is dominated by L2 gas. Budgeting
**~5 HSK** comfortably covers a deployment plus a full demo run.

The L1 fee was obtained by calling `getL1Fee(bytes)` on the `GasPriceOracle` predeploy at
`0x420000000000000000000000000000000000000F`.

---

## Token addresses (mainnet)

| Token | Address | Notes |
| :--- | :--- | :--- |
| USDC | `0x054ed45810DbBAb8B27668922D110669c9D88D0a` | Bridged. `name()` = "Bridged USDC", `symbol()` = `USDC.e`, `decimals()` = **6** |
| USDT | `0xf1b50ed67a9e2cc94ad3c477779e2d4cbfff9029` | |
| WHSK | `0xB210D2120d57b758EE163cFfb43e73728c471Cf1` | |
| WETH | `0xefd4bC9afD210517803f293ABABd701CaeeCdfd0` | |
| WBTC | `0x6119ca49a79f5825c8b345f8d7ac36b272565b14` | |

### USDC on HSK is bridged, not native Circle USDC

This matters for how ZIP-0 is described. On Avalanche the vault uses native Circle USDC; on HSK it
uses a bridged representation (`USDC.e`). Functionally the vault is unaffected — it accepts any
ERC-20 and the decimals match — but claims of "native Circle USDC across all chains" are not
accurate for HSK.

HashKey does not publish testnet token addresses. Use the repository's `MockUSDC` on testnet.

### EIP-2612 permit is supported

Queried directly against HSK mainnet USDC:

- `DOMAIN_SEPARATOR()` → `0x78101f50ab6b299bde76a9973e97b1c9ead7df26f6a40692f4440296a507259d`
- `PERMIT_TYPEHASH()` → `0x6e71edae12b1b97f4d1f60370fef10105fa2faae0126114a169c64845d6126c9` (canonical)
- `nonces(address)` → responds

`ZIP0PaymentVault.depositWithPermit()` therefore works on HSK mainnet without modification.

---

## Jovian upgrade — already active

| Network | Activation |
| :--- | :--- |
| Testnet | 2026-07-09 06:30 UTC |
| Mainnet | 2026-07-29 06:30 UTC |

Both are live. Jovian brings Isthmus, which reaches Prague parity: EIP-7702 (set-code
transactions), EIP-2537 (BLS12-381 precompiles), EIP-2935 (historical block hashes), and EIP-7623
(increased calldata cost). It also introduces a configurable operator fee and EIP-1559
configurability via `SystemConfig`.

**Impact on ZIP-0: none.** The vault compiles with `evmVersion: cancun`, which remains valid on a
Prague-capable chain. Moving to `prague` is optional and unnecessary for current functionality.

---

## Ecosystem services

These are available on HSK and relevant to a payments product. None are integrated yet.

### Safe multisig

| | URL |
| :--- | :--- |
| Mainnet UI | `https://multisig.hashkeychain.net/welcome?chain=HSK` |
| Testnet UI | `https://testnet-safe.hsk.xyz/welcome?chain=HSKT` |
| Transaction service | `https://safe-transaction-hashkey.safe.global` |

Assigning `TREASURY_ROLE` to a Safe would make ZIP-0's institutional custody story verifiable
rather than aspirational.

### Price oracles (mainnet)

APRO push-based feeds:

| Feed | Address |
| :--- | :--- |
| USDC/USD | `0x244Ce344df8837c9d938867E2Ffbf0E4B0169B56` |
| USDT/USD | `0x823d7f90f7A3498DB6595886b6B5dC95E6B0B7f3` |
| HSK/USD | `0x86CE42c1b714149Dc3A7b17169EF67b5F78A224b` |
| BTC/USD | `0x204ED500ab56A2E19B051561258E3A45c850360F` |

Also available: SUPRA pull oracle (`0x16f70cAD28dd621b0072B5A8a8c392970E87C3dD`) and Chainlink
Streams verifier (`0x3278e7a582B94d82487d4B99b31A511CbAe2Cd54`).

The USDC/USD feed is the natural building block for depeg monitoring on a stablecoin settlement
rail.

### On-chain KYC

HashKey provides a Soul Bound Token identity system via the `IKycSBT` interface — `requestKyc()`,
`isHuman()`, `getKycInfo()` — with verification levels NONE / BASIC / ADVANCED / PREMIUM / ULTIMATE
and statuses NONE / APPROVED / REVOKED. Portal: `https://kyc-testnet.hunyuankyc.com/`.

Currently documented for testnet only. This is the most direct path to making ZIP-0's compliance
claims enforceable on-chain.

### Flashblocks

The sequencer streams partial blocks roughly every 200 ms over WebSocket at
`wss://testnet-flashblocks.hsk.xyz/ws`, giving sub-second preconfirmation visibility.

**Testnet only.** Not available on mainnet. For a payments product this is the strongest latency
story HSK offers, but it cannot currently be demonstrated on mainnet.

### Subgraph indexing

The Graph hosted service supports HSK **mainnet only**. Use `network: hashkeychain` in
`subgraph.yaml` (CAIP-2 `eip155:177`). Useful for indexing `PaymentInitiated` / `PaymentReleased`
events.

---

## Contract verification

Verification works through Blockscout, but the API URL published in HashKey's documentation is not
the one you can configure. Both explorer hosts answer with a `301` to a **different domain**:

| Published host | Actually serves the API |
|---|---|
| `testnet-explorer.hsk.xyz` | `testnet-explorer.hskchain.net` |
| `hashkey.blockscout.com` | `hsk.blockscout.com` |

`curl` hides this when you pass `-L`, so a manual probe looks healthy. `hardhat-verify` does **not**
follow redirects: it receives the HTML redirect body and fails with

```
A network request failed. This is an error from the block explorer, not Hardhat.
Error: Unexpected token '<', "<html> ..." is not valid JSON
```

The fix is to configure the post-redirect hosts directly in `customChains` (already applied in
`packages/contracts-evm/hardhat.config.ts`). Blockscout accepts any non-empty API key.

### Proven recipe

```bash
pnpm --filter @zip-0/contracts-evm exec hardhat verify --network hskTestnet \
  <vault-address> <usdcToken> <admin> <initialRelayer>
```

Confirm independently — do not trust the command's own output alone:

```bash
curl -s "https://testnet-explorer.hskchain.net/api?module=contract&action=getabi&address=<addr>"
# verified   -> {"message":"OK","result":"[{...ABI...}]","status":"1"}
# unverified -> {"message":"Contract source code not verified","result":null,"status":"0"}
```

### Recovering constructor arguments

If the deployment record is lost, the arguments are appended to the creation bytecode. Read it from
the v2 API and take the trailing 32-byte words, one per argument:

```bash
curl -sL "https://testnet-explorer.hskchain.net/api/v2/smart-contracts/<addr>" # -> creation_bytecode
```

### Known limitation

`MockUSDC` (`0x1f65E72EE31F709969Dfc75f98f5867EaE332CD9`) still fails with the HTML error above even
with the corrected host, while the vault verifies against the same configuration. The cause is not
yet identified. It is a test mock rather than a settlement contract, so it is not on the critical
path; use the Blockscout web form if it needs verifying.

---

## OP Stack predeploys

Identical on mainnet and testnet:

| Contract | Address |
| :--- | :--- |
| L2CrossDomainMessenger | `0x4200000000000000000000000000000000000007` |
| GasPriceOracle | `0x420000000000000000000000000000000000000F` |
| L2StandardBridge | `0x4200000000000000000000000000000000000010` |
| OptimismMintableERC20Factory | `0x4200000000000000000000000000000000000012` |
| L2ToL1MessagePasser | `0x4200000000000000000000000000000000000016` |

---

## References

- Documentation: <https://docs.hskchain.net/>
- Developer QuickStart: <https://docs.hskchain.net/docs/Developer-QuickStart> (testnet only — it
  does not document mainnet configuration)
- Network info: <https://docs.hskchain.net/docs/Build-on-HashKey-Chain/network-info>
- Developer hub: <https://hashfans.io/>
- Discord: <https://discord.com/invite/V7kypNm9cS>
- Grants (Session 1): <https://github.com/orgs/HashkeyHSK/discussions/categories/session-1>
