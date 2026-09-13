## Why

The HSK testnet vault (`0x14e59806054773fc341377aEC472C07e500BCc86`) was deployed before ABI changes landed for refund timeout (`claimRefund`, `acknowledgePayment`) in #25 and ERC-3009 gasless authorization (`depositWithAuthorization`) in #28. Redeploying the vault from the current `main` branch ensures the live testnet deployment matches the repository bytecode and unblocks explorer verification (#5) and live demo payments (#6).

## What Changes

- Redeploy `MockUSDC` and `ZIP0PaymentVault` to HashKey Chain Testnet (Chain ID 133) using the current smart contract bytecode.
- Ensure the deployer account configures `RELAYER_ROLE` on the newly deployed vault so payment settlements and acknowledgements can be executed.
- Seed the newly deployed testnet vault with initial MockUSDC liquidity (50,000 USDC).
- Update network configuration tables in `README.md` and evidence in `docs/project-status.md` with new testnet contract addresses and verification records.
- Adjust testnet deployment guards in `scripts/deploy.ts` to allow testing signers while maintaining strict protection for production networks.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `hsk-payment-vault`: Update live deployment references and verify that on-chain runtime bytecode provides `claimRefund`, `acknowledgePayment`, and `depositWithAuthorization`.

## Impact

- `packages/contracts-evm`: `scripts/deploy.ts` execution against HSK Testnet.
- `README.md` & `docs/project-status.md`: Contract addresses and status table updates.
- Downstream issues: Unblocks #5 (explorer verification), #6 (live payment demo), and #7 (video demo).
