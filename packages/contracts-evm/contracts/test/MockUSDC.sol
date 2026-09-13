// SPDX-License-Identifier: MIT
pragma solidity >=0.8.20 <0.9.0;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title MockUSDC
 * @notice Test token with 6 decimals, EIP-2612 permit, and a minimal ERC-3009
 *         `transferWithAuthorization` implementation.
 *
 * The ERC-3009 EIP-712 domain intentionally mirrors Circle USDC (name "USD Coin", version "2")
 * so the TypeScript signing helper in the cctp-bridge package produces signatures this token
 * accepts — the same helper targets the real token on testnet. The permit path keeps
 * OpenZeppelin's default version "1" so the existing permit tests are untouched.
 */
contract MockUSDC is ERC20Permit {
    using ECDSA for bytes32;

    bytes32 public constant TRANSFER_WITH_AUTHORIZATION_TYPEHASH = keccak256(
        "TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
    );

    bytes32 private constant EIP712_DOMAIN_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );
    bytes32 private constant ERC3009_NAME_HASH = keccak256("USD Coin");
    bytes32 private constant ERC3009_VERSION_HASH = keccak256("2");

    mapping(address => mapping(bytes32 => bool)) private _authorizationStates;

    event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce);

    constructor() ERC20("USD Coin", "USDC") ERC20Permit("USD Coin") {
        _mint(msg.sender, 1_000_000 * 10 ** 6);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function authorizationState(address authorizer, bytes32 nonce) external view returns (bool) {
        return _authorizationStates[authorizer][nonce];
    }

    function transferWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        require(block.timestamp > validAfter, "Authorization not yet valid");
        require(block.timestamp < validBefore, "Authorization expired");
        require(!_authorizationStates[from][nonce], "Authorization already used");

        bytes32 structHash = keccak256(
            abi.encode(
                TRANSFER_WITH_AUTHORIZATION_TYPEHASH,
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce
            )
        );
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", _domainSeparatorErc3009(), structHash)
        );

        require(digest.recover(v, r, s) == from, "Invalid authorization signature");

        _authorizationStates[from][nonce] = true;
        _transfer(from, to, value);

        emit AuthorizationUsed(from, nonce);
    }

    function _domainSeparatorErc3009() internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                ERC3009_NAME_HASH,
                ERC3009_VERSION_HASH,
                block.chainid,
                address(this)
            )
        );
    }
}
