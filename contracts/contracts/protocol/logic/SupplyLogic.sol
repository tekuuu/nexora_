// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint64, ebool, externalEuint64, euint128} from "@fhevm/solidity/lib/FHE.sol";
import {Types} from "../../libraries/Types.sol";
import {Errors} from "../../libraries/Errors.sol";
import {Constants} from "../../config/Constants.sol";
import {SafeFHEOperations} from "../../libraries/SafeFHEOperations.sol";
import {SafeMath64} from "../../libraries/SafeMath64.sol";
import {ConfidentialFungibleToken} from "@openzeppelin/confidential-contracts/token/ConfidentialFungibleToken.sol";


library SupplyLogic {
    using FHE for euint64;
    using FHE for ebool;
    using FHE for euint128;
    using SafeFHEOperations for euint64;
    using SafeMath64 for uint64;

    event SupplyExecuted(address indexed user, address indexed asset, uint64 timestamp);
    event WithdrawExecuted(address indexed user, address indexed asset, uint64 timestamp);

    function executeSupply(
        address asset,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof,
        Types.ConfidentialReserve storage reserve,
        euint64 userBalance,
        Types.ConfidentialUserPosition storage userPosition
    ) external returns (euint64 newUserBalance) {
        require(reserve.active, Errors.RESERVE_NOT_ACTIVE);
        require(!reserve.isPaused, Errors.PROTOCOL_PAUSED);
        require(asset != address(0), Errors.ZERO_ADDRESS);

        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);

        // --- Supply Cap Check ---
        euint64 maxAllowedAmount = FHE.asEuint64(Constants.MAX_EUINT64);
        if (reserve.supplyCap > 0) {
             euint64 currentTotalSupply = reserve.totalSupplied; 
             euint64 cap = FHE.asEuint64(reserve.supplyCap);
             euint64 remainingCap = cap.safeSub(currentTotalSupply);
             maxAllowedAmount = remainingCap;
        }
        euint64 finalAmount = amount.validateAndCap(maxAllowedAmount);

        if (!userPosition.initialized) {
            userPosition.initialized = true;
        }

        FHE.allowTransient(finalAmount, asset);
        ConfidentialFungibleToken(asset).confidentialTransferFrom(
            msg.sender,
            address(this),
            finalAmount
        );

        newUserBalance = userBalance.safeAdd(finalAmount);
        reserve.totalSupplied = reserve.totalSupplied.safeAdd(finalAmount);
        reserve.availableLiquidity = reserve.availableLiquidity.safeAdd(finalAmount);

        // Grant ACL permissions
        FHE.allow(newUserBalance, msg.sender);
        FHE.allowThis(newUserBalance);
        FHE.allowThis(reserve.totalSupplied);
        FHE.allowThis(reserve.availableLiquidity);
        FHE.makePubliclyDecryptable(reserve.availableLiquidity);
        FHE.makePubliclyDecryptable(reserve.totalSupplied); 

        emit SupplyExecuted(msg.sender, asset, uint64(block.timestamp));
        return newUserBalance;
    }


    function executeWithdraw(
        address asset,
        euint64 withdrawAmount,
        Types.ConfidentialReserve storage reserve,
        euint64 userBalance,
        address user
    ) external returns (euint64 newUserBalance) {
        require(reserve.active, Errors.RESERVE_NOT_ACTIVE);
        require(!reserve.isPaused, Errors.PROTOCOL_PAUSED);
        require(asset != address(0), Errors.ZERO_ADDRESS);

        euint64 finalAmount = withdrawAmount.validateAndCap(userBalance);

        newUserBalance = userBalance.safeSub(finalAmount);
        reserve.totalSupplied = reserve.totalSupplied.safeSub(finalAmount);
        reserve.availableLiquidity = reserve.availableLiquidity.safeSub(finalAmount);

        // Grant ACL permissions
        FHE.allow(newUserBalance, user);
        FHE.allowThis(newUserBalance);
        FHE.allowThis(reserve.totalSupplied);
        FHE.allowThis(reserve.availableLiquidity);
        FHE.makePubliclyDecryptable(reserve.availableLiquidity);
        FHE.makePubliclyDecryptable(reserve.totalSupplied);

        FHE.allowTransient(finalAmount, asset);
        ConfidentialFungibleToken(asset).confidentialTransfer(
            user,
            finalAmount
        );

        emit WithdrawExecuted(user, asset, uint64(block.timestamp));
        return newUserBalance;
    }
}