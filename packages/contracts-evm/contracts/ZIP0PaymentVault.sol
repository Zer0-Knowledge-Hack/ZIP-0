// SPDX-License-Identifier: MIT
pragma solidity >=0.8.20 <0.9.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ZIP0PaymentVault
 * @notice Vault contract for locking payments in HSK Chain (or any EVM) and releasing USDC
 *         upon cross-chain settlement from Stellar (Pollar) or CCTP.
 */
contract ZIP0PaymentVault is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");

    IERC20 public immutable usdcToken;

    enum PaymentStatus {
        NONE,
        INITIATED,
        RELEASED,
        REFUNDED
    }

    struct Payment {
        bytes32 paymentId;
        address payer;
        address recipient;
        uint256 amount;
        uint32 destinationDomain;
        bytes32 destinationRecipient;
        PaymentStatus status;
        uint256 timestamp;
    }

    mapping(bytes32 => Payment) public payments;

    event PaymentInitiated(
        bytes32 indexed paymentId,
        address indexed payer,
        uint256 amount,
        uint32 destinationDomain,
        bytes32 destinationRecipient,
        bytes metadata
    );

    event PaymentReleased(
        bytes32 indexed paymentId,
        address indexed recipient,
        uint256 amount,
        address relayer
    );

    event PaymentRefunded(
        bytes32 indexed paymentId,
        address indexed payer,
        uint256 amount
    );

    event VaultRebalanced(
        address indexed destination,
        uint256 amount,
        address treasury
    );

    constructor(address _usdcToken, address admin, address initialRelayer) {
        require(_usdcToken != address(0), "Invalid token address");
        require(admin != address(0), "Invalid admin");

        usdcToken = IERC20(_usdcToken);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(TREASURY_ROLE, admin);

        if (initialRelayer != address(0)) {
            _grantRole(RELAYER_ROLE, initialRelayer);
        }
    }

    /**
     * @notice Deposits USDC to initiate a cross-chain payment.
     * @param paymentId Unique identifier for this payment.
     * @param amount Amount of USDC tokens (6 decimals).
     * @param destinationDomain Domain ID of destination chain (e.g. 21 for Stellar).
     * @param destinationRecipient Recipient address on destination chain formatted as bytes32.
     * @param metadata Arbitrary payload or order context.
     */
    function depositPayment(
        bytes32 paymentId,
        uint256 amount,
        uint32 destinationDomain,
        bytes32 destinationRecipient,
        bytes calldata metadata
    ) external nonReentrant {
        _depositPayment(paymentId, amount, destinationDomain, destinationRecipient, metadata);
    }

    /**
     * @notice Gasless / 1-click deposit using EIP-2612 permit signature.
     */
    function depositWithPermit(
        bytes32 paymentId,
        uint256 amount,
        uint32 destinationDomain,
        bytes32 destinationRecipient,
        bytes calldata metadata,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external nonReentrant {
        IERC20Permit(address(usdcToken)).permit(
            msg.sender,
            address(this),
            amount,
            deadline,
            v,
            r,
            s
        );

        _depositPayment(
            paymentId,
            amount,
            destinationDomain,
            destinationRecipient,
            metadata
        );
    }

    function _depositPayment(
        bytes32 paymentId,
        uint256 amount,
        uint32 destinationDomain,
        bytes32 destinationRecipient,
        bytes calldata metadata
    ) internal {
        require(payments[paymentId].status == PaymentStatus.NONE, "Payment already exists");
        require(amount > 0, "Amount must be > 0");

        payments[paymentId] = Payment({
            paymentId: paymentId,
            payer: msg.sender,
            recipient: address(0),
            amount: amount,
            destinationDomain: destinationDomain,
            destinationRecipient: destinationRecipient,
            status: PaymentStatus.INITIATED,
            timestamp: block.timestamp
        });

        usdcToken.safeTransferFrom(msg.sender, address(this), amount);

        emit PaymentInitiated(
            paymentId,
            msg.sender,
            amount,
            destinationDomain,
            destinationRecipient,
            metadata
        );
    }

    /**
     * @notice Releases USDC to a recipient in HSK. Called by authorized relayer.
     * @param paymentId Unique identifier matching the cross-chain settlement.
     * @param recipient Recipient address receiving funds in HSK.
     * @param amount Amount of USDC to release.
     */
    function releasePayment(
        bytes32 paymentId,
        address recipient,
        uint256 amount
    ) external onlyRole(RELAYER_ROLE) nonReentrant {
        require(payments[paymentId].status == PaymentStatus.NONE, "Payment ID already processed");
        require(recipient != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be > 0");
        require(usdcToken.balanceOf(address(this)) >= amount, "Insufficient vault liquidity");

        payments[paymentId] = Payment({
            paymentId: paymentId,
            payer: address(0),
            recipient: recipient,
            amount: amount,
            destinationDomain: 0,
            destinationRecipient: bytes32(0),
            status: PaymentStatus.RELEASED,
            timestamp: block.timestamp
        });

        usdcToken.safeTransfer(recipient, amount);

        emit PaymentReleased(paymentId, recipient, amount, msg.sender);
    }

    /**
     * @notice Refunds a failed or unfulfilled payment to the original payer.
     */
    function refundPayment(bytes32 paymentId) external onlyRole(RELAYER_ROLE) nonReentrant {
        Payment storage payment = payments[paymentId];
        require(payment.status == PaymentStatus.INITIATED, "Payment not refundable");

        payment.status = PaymentStatus.REFUNDED;
        usdcToken.safeTransfer(payment.payer, payment.amount);

        emit PaymentRefunded(paymentId, payment.payer, payment.amount);
    }

    /**
     * @notice Allows treasury to rebalance liquidity between chains.
     */
    function rebalanceVault(
        address destination,
        uint256 amount
    ) external onlyRole(TREASURY_ROLE) nonReentrant {
        require(destination != address(0), "Invalid destination");
        require(usdcToken.balanceOf(address(this)) >= amount, "Insufficient balance");

        usdcToken.safeTransfer(destination, amount);
        emit VaultRebalanced(destination, amount, msg.sender);
    }
}
