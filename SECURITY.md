# Security Policy

ZIP-0 moves value between chains. Treat every key as production, because the code that handles
testnet funds is the code that will handle real ones.

## Reporting a vulnerability

Do **not** open a public issue for a security problem. Contact a repository maintainer directly.

If the finding concerns a deployed contract, include the network, the contract address, and a
concrete reproduction.

## Key handling — non-negotiable rules

1. **Never commit a private key.** Not as a default, not as a fallback, not "just for testing".
2. **No literal-key fallbacks in code.** If an environment variable is missing, the program must
   fail loudly. A committed fallback in a public repository is a published key, and it will be
   used silently the moment someone forgets to set the variable.
3. **Never reuse a key across environments.** The deployer key, the relayer key, and any test
   payer key must be distinct, and mainnet keys must never have existed on a developer laptop
   that also runs testnet scripts.
4. **Assume any leaked key is permanently compromised.** Rewriting Git history does not un-leak a
   key: forks, clones, caches, and mirrors keep their copy. The only remedy is rotation.
5. **Fund deployer keys with the minimum needed.** A mainnet deployment of `ZIP0PaymentVault`
   costs roughly 1.25–1.75 HSK. Do not hold more than the task requires.

`.gitignore` covers `.env`, `.env.*`, `*.pem`, and `wallets`, but the last line of defence is you.
Check `git diff --staged` before every commit.

## Trust model of the deployed system

`ZIP0PaymentVault` is **not trust-minimized** in its current form.

Any address holding `RELAYER_ROLE` can call `releasePayment()` for any unused `paymentId`, to any
recipient, for any amount up to the vault balance. There is no on-chain proof of the corresponding
credit on the source chain.

This means a compromised relayer key is equivalent to full control of vault float. Guard it
accordingly, and keep vault liquidity proportionate to what the deployment actually needs.

Making settlement trust-minimized is the purpose of the planned CCTP rail. See
[`docs/project-status.md`](docs/project-status.md).

## Role management

`DEFAULT_ADMIN_ROLE` can grant and revoke `RELAYER_ROLE` and `TREASURY_ROLE`. If a relayer key is
suspected of exposure:

1. Generate a new key offline.
2. Grant `RELAYER_ROLE` to the new address.
3. **Revoke `RELAYER_ROLE` from the old address.**
4. Move vault float if the exposure window was long.

Revocation is what actually stops an attacker. Granting a replacement without revoking the old
address changes nothing.

Consider assigning `TREASURY_ROLE` to a Safe multisig rather than an EOA — HashKey Chain provides
one at `https://multisig.hashkeychain.net`.

## Scope

This policy covers the contracts in `packages/contracts-evm` and the relayer in
`packages/cctp-bridge`. This is hackathon-stage software and has not been audited. Do not deploy
it with funds you are unwilling to lose.
