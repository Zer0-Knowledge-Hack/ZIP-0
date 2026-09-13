## MODIFIED Requirements

### Requirement: Multi-Chain Deployment and Live Liquidity Provisioning
The deployment pipeline SHALL support deploying `ZIP0PaymentVault` and `MockUSDC` to target EVM networks including HashKey Chain Testnet (Chain ID 133), funding the deployed vault with initial test liquidity to service cross-chain release settlements, and confirming that the deployed bytecode matches current main branch capabilities.

#### Scenario: HashKey Testnet Deployment and Verification
- **WHEN** the deployment script executes against HashKey Chain Testnet with a funded deployer account
- **THEN** `MockUSDC` and `ZIP0PaymentVault` contracts are successfully deployed on-chain
- **AND** `eth_getCode` returns non-empty runtime bytecode for both contracts
- **AND** the vault contract holds a non-zero MockUSDC token balance
- **AND** the configured relayer address possesses `RELAYER_ROLE` on the vault
- **AND** the on-chain contract bytecode provides runtime support for `claimRefund`, `acknowledgePayment`, and `depositWithAuthorization`.
