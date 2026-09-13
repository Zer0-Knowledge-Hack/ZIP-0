# Proposal: Deploy ZIP0PaymentVault & MockUSDC to HashKey Chain Testnet (133)

## Why
HashKey Chain Testnet (Chain ID 133) is a primary EVM deployment target for the ZIP-0 cross-chain payment bridge and institutional settlement infrastructure. Deploying the core payment vault (`ZIP0PaymentVault`) and a testnet token (`MockUSDC`) establishes the live on-chain escrow and settlement target required for cross-chain testing and unblocks integration demos.

## What Changes
1. **Deploy Script Enhancement (`packages/contracts-evm/scripts/deploy.ts`)**:
   - Ensure `MockUSDC` is deployed on `hskTestnet` when no token address is specified.
   - Deploy `ZIP0PaymentVault` pointing to the deployed `MockUSDC`.
   - Seed the vault with an initial liquidity balance of MockUSDC (e.g. 50,000 MockUSDC) so that inbound payment releases have liquidity to settle.
   - Verify deployed bytecode on-chain via `eth_getCode`.
   - Verify `RELAYER_ROLE` assignment on the vault.
2. **Execute Deployment on HSK Testnet**:
   - Run `pnpm --filter @zip-0/contracts-evm deploy:hsk-testnet`.
   - Confirm transaction confirmations and record deployed contract addresses.
3. **Documentation & Network Registry Update**:
   - Update `README.md` networks table with the deployed HSK Testnet contract addresses and explorer links.
   - Update `docs/project-status.md` to reflect live HSK Testnet deployment.

## Capabilities
- `hsk-payment-vault`: deployed on HashKey Chain Testnet with verified bytecode, initial liquidity, and relayer role.

## Impact
- Enables end-to-end payment escrow and settlement verification against live HashKey Chain testnet.
- Does not modify any Solidity contracts (`contracts/*.sol`) or `hardhat.config.ts`.
