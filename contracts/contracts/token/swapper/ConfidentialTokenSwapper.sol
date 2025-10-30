// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IConfidentialFungibleToken} from "@openzeppelin/confidential-contracts/interfaces/IConfidentialFungibleToken.sol";
import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {FHE, externalEuint64, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title ERC20 <-> ERC7984 Token Swapper
contract ConfidentialTokenSwapper is Ownable, SepoliaConfig, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // --- Constants ---
    uint64 private constant INTERNAL_DECIMALS_FACTOR = 10**6;

    // --- Errors ---
    error InvalidTokenPair();
    error InsufficientBalance();
    error InvalidAmount();
    error InvalidRecipient();
    error InvalidGatewayRequest(uint256 requestId);
    error AmountExceedsUint64(); 

    // --- Events---
    event ERC20ToConfidentialSwap(address indexed user, address indexed erc20, uint256 amount, address indexed confidential);
    event ConfidentialToERC20SwapInitiated(address indexed user, address indexed confidential, uint256 requestId, address indexed erc20);
    event ConfidentialToERC20SwapFinalized(address indexed user, uint256 requestId, uint64 amount, address indexed erc20); 

    // --- State Variables---
    mapping(address => address) private _erc20ToConfidential;
    mapping(address => address) private _confidentialToErc20;
    mapping(address => bool) private _supportedTokens;
    mapping(uint256 requestId => address) private _receivers;
    mapping(uint256 requestId => address) private _erc20Tokens;

    // --- Constructor---
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
        require(conf != address(0), "Pair not found"); 
        delete _erc20ToConfidential[erc20Token];
        delete _confidentialToErc20[conf];
        delete _supportedTokens[erc20Token]; 
    }

    // -------------------------------------------------
    // 🔸 ERC20 -> Confidential
    // -------------------------------------------------
    function swapERC20ToConfidential(
        address erc20Token,
        uint256 nativeAmount,
        address to
    ) external nonReentrant {
        if (!_supportedTokens[erc20Token]) revert InvalidTokenPair();
        if (nativeAmount == 0) revert InvalidAmount();
        if (to == address(0)) revert InvalidRecipient();
        address confToken = _erc20ToConfidential[erc20Token];

        uint8 nativeDecimals = IERC20Metadata(erc20Token).decimals();
        uint256 amountE6_uint256;
        if (nativeDecimals == 6) {
             amountE6_uint256 = nativeAmount;
        } else if (nativeDecimals > 6) {
            uint256 scalingFactor = 10**uint256(nativeDecimals - 6);
            amountE6_uint256 = nativeAmount / scalingFactor;
        } else {
            uint256 scalingFactor = 10**uint256(6 - nativeDecimals);
            amountE6_uint256 = nativeAmount * scalingFactor;
        }
        require(amountE6_uint256 > 0 || nativeAmount == 0, "Amount too small");
        if (amountE6_uint256 > type(uint64).max) {
             revert AmountExceedsUint64();
        }
        uint64 amountE6 = uint64(amountE6_uint256);
        IERC20(erc20Token).safeTransferFrom(msg.sender, address(this), nativeAmount);

        (bool success, bytes memory returnData) = confToken.call(
            abi.encodeWithSignature("mint(address,uint64)", to, amountE6));
        require(success, string(abi.encodePacked("Mint failed: ", returnData))); 

        emit ERC20ToConfidentialSwap(msg.sender, erc20Token, nativeAmount, confToken);
    }

    // ----------------------------------------------
    // 🔸 Confidential -> ERC20
    // ----------------------------------------------
    function swapConfidentialToERC20(
        address confToken,
        externalEuint64 encryptedAmountE6, 
        bytes calldata inputProof
    ) external nonReentrant returns (uint256 requestId) {
        address erc20Token = _confidentialToErc20[confToken];
        if (erc20Token == address(0)) revert InvalidTokenPair();

        euint64 amountE6 = FHE.fromExternal(encryptedAmountE6, inputProof);

        FHE.allowTransient(amountE6, confToken);

        euint64 amountTransferredE6 = IConfidentialFungibleToken(confToken).confidentialTransferFrom(
            msg.sender,
            address(this),
            amountE6
        );

        bytes32[] memory cts = new bytes32[](1);
        cts[0] = euint64.unwrap(amountTransferredE6);
        requestId = FHE.requestDecryption(cts, this.finalizeSwap.selector);

        _receivers[requestId] = msg.sender;
        _erc20Tokens[requestId] = erc20Token;

        emit ConfidentialToERC20SwapInitiated(msg.sender, confToken, requestId, erc20Token);
    }

    // ------------------------------------------------------------
    // 🔸 Gateway Callback 
    // ------------------------------------------------------------
    function finalizeSwap(
        uint256 requestId,
        bytes calldata cleartexts,
        bytes calldata decryptionProof
    ) public virtual {
        
        FHE.checkSignatures(requestId, cleartexts, decryptionProof);
        uint64 decryptedAmountE6 = abi.decode(cleartexts, (uint64));
        address to = _receivers[requestId];
        if (to == address(0)) revert InvalidGatewayRequest(requestId);
        address erc20Token = _erc20Tokens[requestId]; 
        delete _receivers[requestId];
        delete _erc20Tokens[requestId]; 

        // Calculate Native ERC20 Amount
        uint256 nativeAmount = 0;
        if (decryptedAmountE6 != 0) {
            uint8 nativeDecimals = IERC20Metadata(erc20Token).decimals();
            if (nativeDecimals == 6) {
                nativeAmount = uint256(decryptedAmountE6);
            } else if (nativeDecimals > 6) {
                uint256 scalingFactor = 10**uint256(nativeDecimals - 6);
                nativeAmount = uint256(decryptedAmountE6) * scalingFactor;
            } else {
                uint256 scalingFactor = 10**uint256(6 - nativeDecimals);
                nativeAmount = uint256(decryptedAmountE6) / scalingFactor;
            }
            require(nativeAmount > 0 || decryptedAmountE6 == 0, "Amount became zero");
        }

        if (nativeAmount > 0) { 
            uint256 contractBalance = IERC20(erc20Token).balanceOf(address(this));
            if (contractBalance < nativeAmount) revert InsufficientBalance();
            IERC20(erc20Token).safeTransfer(to, nativeAmount);
        }

        emit ConfidentialToERC20SwapFinalized(to, requestId, decryptedAmountE6, erc20Token);
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