# ZIP-0 web — banking visual direction

First navigable application preview: purple business dashboard with Lato typography and turquoise accents inspired by the supplied banking reference, payment draft, local PDF fingerprint, help, wallet connection, and ES/EN dictionaries. No transactions are submitted. Balances and history deliberately remain empty until their read integration is implemented. A draft recipient is not yet validated as Stellar StrKey; it must not be used for settlement.

```sh
pnpm --filter @zip-0/web dev
pnpm --filter @zip-0/web build
pnpm --filter @zip-0/web test
pnpm --filter @zip-0/web lint
```

Wallet connection only requests public accounts. The network selector does not switch the wallet network. PDFs stay in the browser; only their Keccak-256 fingerprint is retained in component state. Form state survives page and language switches, but not a reload.

Next integration stage: exact amount and Stellar checksum validation, chain reads, capability detection per deployment, deposit signing, confirmed receipts, and payer refunds. Do not infer ERC-3009 support from REFUND_TIMEOUT alone: contract releases introduced these capabilities separately. ACKNOWLEDGED is not proof of destination settlement; source and destination records must be tracked separately. Existing public test deployments must be revalidated before enabling transactions.

For local integration, run the repository Hardhat node and deployment script, then configure the resulting addresses in a future network adapter. This visual preview needs neither a node nor funds.
