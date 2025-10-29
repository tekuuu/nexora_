// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IConfidentialFungibleToken} from "@openzeppelin/confidential-contracts/interfaces/IConfidentialFungibleToken.sol";
import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {FHE, externalEuint64, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title ERC20 <-> ERC7984 Token Swapper (Gateway-Based)
/// @notice Secure swaps using FHEVM Gateway for cryptographic verification
/// @dev Implements official OpenZeppelin/Zama pattern with Gateway callbacks
contract ConfidentialTokenSwapper is Ownable, SepoliaConfig, ReentrancyGuard {
    using SafeERC20 for IERC20;

    error InvalidTokenPair();
    error InsufficientBalance();
    error InvalidAmount();
    error InvalidRecipient();
    error InvalidGatewayRequest(uint256 requestId);

    event ERC20ToConfidentialSwap(address indexed user, address indexed erc20, uint256 amount, address indexed confidential);
    event ConfidentialToERC20SwapInitiated(address indexed user, address indexed confidential, uint256 requestId, address indexed erc20);
    event ConfidentialToERC20SwapFinalized(address indexed user, uint256 requestId, uint64 amount, address indexed erc20);

    // Token pair mappings
    mapping(address => address) private _erc20ToConfidential;
    mapping(address => address) private _confidentialToErc20;
    mapping(address => bool) private _supportedTokens;
    
    // Gateway callback tracking
    mapping(uint256 requestId => address) private _receivers;
    mapping(uint256 requestId => address) private _erc20Tokens;

    constructor(address owner_) Ownable(owner_) {}

    // ------------------------------------------------------------
    // 🔸 Admin
    // ------------------------------------------------------------
    function addTokenPair(address erc20Token, address confidentialToken) external onlyOwner {
        require(erc20Token != address(0) && confidentialToken != address(0), "Invalid address");
        _erc20ToConfidential[erc20Token] = confidentialToken;
        _confidentialToErc20[confidentialToken] = erc20Token;
        _supportedTokens[erc20Token] = true;
    }

    function removeTokenPair(address erc20Token) external onlyOwner {
        address conf = _erc20ToConfidential[erc20Token];
        delete _erc20ToConfidential[erc20Token];
        delete _confidentialToErc20[conf];
        delete _supportedTokens[erc20Token];
    }

    // ------------------------------------------------------------
    // 🔸 ERC20 -> Confidential (Wrap/Deposit) - Simple & Secure
    // ------------------------------------------------------------
    function swapERC20ToConfidential(
        address erc20Token,
        uint256 amount,
        address to
    ) external nonReentrant {
        if (!_supportedTokens[erc20Token]) revert InvalidTokenPair();
        if (amount == 0) revert InvalidAmount();
        if (to == address(0)) revert InvalidRecipient();

        address confToken = _erc20ToConfidential[erc20Token];

        // ✅ Transfer ERC20 into contract (becomes liquidity pool)
        IERC20(erc20Token).safeTransferFrom(msg.sender, address(this), amount);

        // ✅ Mint confidential tokens 1:1 to user
        (bool success, ) = confToken.call(
            abi.encodeWithSignature("mint(address,uint64)", to, uint64(amount))
        );
        require(success, "Mint failed");

        emit ERC20ToConfidentialSwap(msg.sender, erc20Token, amount, confToken);
    }

    // ------------------------------------------------------------
    // 🔸 Confidential -> ERC20 (Unwrap/Withdraw) - GATEWAY PATTERN
    // ------------------------------------------------------------
    /// @notice Swap confidential tokens to ERC20 using Gateway for secure decryption
    /// @param confToken The confidential token to swap from
    /// @param encryptedAmount The encrypted amount to transfer
    /// @param inputProof Proof for the encrypted amount
    /// @dev User must set this contract as operator before calling
    /// @dev This initiates the swap; Gateway will call finalizeSwap() asynchronously
    function swapConfidentialToERC20(
        address confToken,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external nonReentrant returns (uint256 requestId) {
        address erc20Token = _confidentialToErc20[confToken];
        if (erc20Token == address(0)) revert InvalidTokenPair();

        // ✅ Convert encrypted amount to FHE context
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);

        // ✅ CRITICAL: Allow transient access for the confidential token contract
        FHE.allowTransient(amount, confToken);

        // ✅ Transfer confidential tokens from user to this contract
        // Note: User must have called setOperator(swapperAddress, expirationTimestamp) first
        euint64 amountTransferred = IConfidentialFungibleToken(confToken).confidentialTransferFrom(
            msg.sender,
            address(this),
            amount
        );

        // ✅ Request Gateway decryption (OFFICIAL PATTERN)
        bytes32[] memory cts = new bytes32[](1);
        cts[0] = euint64.unwrap(amountTransferred);
        requestId = FHE.requestDecryption(cts, this.finalizeSwap.selector);

        // ✅ Register the recipient for this decryption request
        _receivers[requestId] = msg.sender;
        _erc20Tokens[requestId] = erc20Token;

        emit ConfidentialToERC20SwapInitiated(msg.sender, confToken, requestId, erc20Token);
    }

    // ------------------------------------------------------------
    // 🔸 Gateway Callback - SECURE PATTERN
    // ------------------------------------------------------------
    /// @notice Called by FHEVM Gateway after decryption completes
    /// @param requestId The decryption request ID
    /// @param cleartexts The decrypted data (ABI-encoded uint64 amount)
    /// @param decryptionProof Gateway signatures proving the decryption is valid
    /// @dev This function can ONLY be called by the Gateway with valid signatures
    function finalizeSwap(
        uint256 requestId,
        bytes calldata cleartexts,
        bytes calldata decryptionProof
    ) public virtual {
        // ✅ CRITICAL: Verify signatures from Gateway (cryptographic proof)
        FHE.checkSignatures(requestId, cleartexts, decryptionProof);
        
        // ✅ Decode the decrypted amount from cleartexts
        uint64 decryptedAmount = abi.decode(cleartexts, (uint64));
        
        // ✅ Get the recipient for this request
        address to = _receivers[requestId];
        if (to == address(0)) revert InvalidGatewayRequest(requestId);
        
        // ✅ Get the ERC20 token for this request
        address erc20Token = _erc20Tokens[requestId];
        
        // ✅ Clean up to prevent replay attacks
        delete _receivers[requestId];
        delete _erc20Tokens[requestId];

        // ✅ Transfer ERC20 tokens if amount > 0
        if (decryptedAmount != 0) {
            uint256 contractBalance = IERC20(erc20Token).balanceOf(address(this));
            if (contractBalance < decryptedAmount) revert InsufficientBalance();
            
            IERC20(erc20Token).safeTransfer(to, decryptedAmount);
        }

        emit ConfidentialToERC20SwapFinalized(to, requestId, decryptedAmount, erc20Token);
    }

    // ------------------------------------------------------------
    // 🔸 View Helpers
    // ------------------------------------------------------------
    function getConfidentialToken(address erc20Token) external view returns (address) {
        return _erc20ToConfidential[erc20Token];
    }

    function getERC20Token(address confToken) external view returns (address) {
        return _confidentialToErc20[confToken];
    }

    function isTokenSupported(address erc20Token) external view returns (bool) {
        return _supportedTokens[erc20Token];
    }
    
    function getPendingSwap(uint256 requestId) external view returns (address receiver, address erc20Token) {
        return (_receivers[requestId], _erc20Tokens[requestId]);
    }

    // ------------------------------------------------------------
    // 🔸 Emergency Admin
    // ------------------------------------------------------------
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }
}
