## ADDED Requirements

### Requirement: Strict Recipient Address Validation for Vault Releases
The vault settlement rail SHALL validate that the destination recipient is a valid 20-byte EVM address formatted as a lowercase or checksummed hex string prefixed with `0x` before calling the underlying vault contract release method.

#### Scenario: Valid EVM recipient address passes validation
- **WHEN** a settlement execution is dispatched with a valid 40-character hex EVM recipient starting with `0x`
- **THEN** the rail formats and passes the address to `releasePayment` without error.

#### Scenario: Stellar recipient address is rejected
- **WHEN** a settlement execution is dispatched with a Stellar address (e.g. starting with `G`)
- **THEN** the rail throws a `BridgeError` with code `INVALID_RECIPIENT` and does not release funds.

#### Scenario: Malformed recipient string is rejected
- **WHEN** a settlement execution is dispatched with an invalid recipient string (such as truncated hex, empty string, or invalid characters)
- **THEN** the rail throws a `BridgeError` with code `INVALID_RECIPIENT`.
