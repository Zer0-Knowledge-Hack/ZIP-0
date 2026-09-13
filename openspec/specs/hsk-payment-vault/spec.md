# hsk-payment-vault Specification

## Purpose
Provides secure on-chain payment escrow, permit-based deposits, and role-authorized release mechanisms for USDC payments on HashKey Chain (HSK) and EVM networks.
## Requirements
### Requirement: Payment Deposit with Token Transfer
The contract SHALL allow payers to deposit USDC specifying a unique payment identifier, destination domain, and destination recipient bytes.

#### Scenario: Successful payment deposit
- **WHEN** a user deposits 100 USDC with a valid non-colliding `paymentId` and prior approval
- **THEN** the contract transfers 100 USDC from the user into the vault and emits a `PaymentInitiated` event with the payment details.

### Requirement: Gasless Deposit via EIP-2612 Permit
The contract SHALL allow payers to submit an EIP-2612 permit signature alongside the deposit call to execute allowance approval and payment deposit in a single atomic transaction.

#### Scenario: Successful permit deposit
- **WHEN** a user submits valid deadline, v, r, s permit parameters and deposit parameters
- **THEN** the contract executes permit on the USDC token, takes custody of the amount, records the payment as `INITIATED`, and emits `PaymentInitiated`.

### Requirement: Relayer-Authorized Payment Release
The contract SHALL restrict fund release execution exclusively to accounts assigned the `RELAYER_ROLE`.

#### Scenario: Authorized relayer release
- **WHEN** an address possessing `RELAYER_ROLE` calls `releasePayment` for an existing payment ID and recipient address with sufficient vault liquidity
- **THEN** the contract transfers the requested amount to the recipient and emits a `PaymentReleased` event.

#### Scenario: Unauthorized caller release rejection
- **WHEN** an address lacking `RELAYER_ROLE` calls `releasePayment`
- **THEN** the transaction reverts with an access control error.

### Requirement: Multi-Chain Deployment and Live Liquidity Provisioning
The deployment pipeline SHALL support deploying `ZIP0PaymentVault` and `MockUSDC` to target EVM networks including HashKey Chain Testnet (Chain ID 133), funding the deployed vault with initial test liquidity to service cross-chain release settlements.

#### Scenario: HashKey Testnet Deployment and Verification
- **WHEN** the deployment script executes against HashKey Chain Testnet with a funded deployer account
- **THEN** `MockUSDC` and `ZIP0PaymentVault` contracts are successfully deployed on-chain
- **AND** `eth_getCode` returns non-empty runtime bytecode for both contracts
- **AND** the vault contract holds a non-zero MockUSDC token balance
- **AND** the configured relayer address possesses `RELAYER_ROLE` on the vault.

