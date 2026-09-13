// SPDX-License-Identifier: MIT
pragma solidity >=0.8.20 <0.9.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface IRefundableVault {
    function depositPayment(
        bytes32 paymentId,
        uint256 amount,
        uint32 destinationDomain,
        bytes32 destinationRecipient,
        bytes calldata metadata
    ) external;

    function claimRefund(bytes32 paymentId) external;
}

/**
 * @dev Test-only token that also acts as the payer. When the vault refunds it, the token
 *      re-enters claimRefund, so tests can prove the vault's reentrancy guard holds.
 */
contract ReentrantRefundToken is ERC20 {
    address public vault;
    bytes32 public paymentId;
    bool private reentered;

    constructor() ERC20("Reentrant USD", "rUSD") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function depositInto(address _vault, bytes32 _paymentId, uint256 amount) external {
        vault = _vault;
        paymentId = _paymentId;
        _mint(address(this), amount);
        _approve(address(this), _vault, amount);
        IRefundableVault(_vault).depositPayment(_paymentId, amount, 21, bytes32(0), "");
    }

    function claim() external {
        IRefundableVault(vault).claimRefund(paymentId);
    }

    function _update(address from, address to, uint256 value) internal override {
        super._update(from, to, value);

        if (from == vault && to == address(this) && !reentered) {
            reentered = true;
            IRefundableVault(vault).claimRefund(paymentId);
        }
    }
}
