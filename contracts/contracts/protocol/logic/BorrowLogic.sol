// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Types} from "../../libraries/Types.sol";
import {ProtocolErrors} from "../../libraries/Errors.sol";
import {Constants} from "../../config/Constants.sol";
import {SafeFHEOperations} from "../../libraries/SafeFHEOperations.sol"; 
import {SafeMath64} from "../../libraries/SafeMath64.sol";
import {ConfidentialFungibleToken} from "@openzeppelin/confidential-contracts/token/ConfidentialFungibleToken.sol";
import {FHE, euint64, ebool, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";

/**
 * @title BorrowLogic
 * @notice Handles borrow and repayment logic
 * @dev All internal euint64 balances represent amounts normalized to 6 decimals.
 */
library BorrowLogic {
    using FHE for euint64;
    using FHE for ebool;
    using SafeFHEOperations for euint64;
    using SafeMath64 for uint64;

    /**
     * @notice Executes a borrow operation.
     * @dev Assumes amountE6 input is the final, approved 6-decimal amount. De-normalizes for transfer.
     * @param asset The address of the asset being borrowed.
     * @param amount The amount to borrow (normalized to 6 decimals).
     * @param reserve Storage pointer to the asset's reserve configuration.
     * @param userBorrowBalance The user's current borrow balance (normalized to 6 decimals).
     * @param userPosition Storage pointer to the user's position data (used for initialization check).
     * @param user The address of the user performing the borrow.
     * @return newUserBorrowBalance The user's new borrow balance (normalized to 6 decimals).
     */
    function executeBorrow(
        address asset,
        euint64 amount,
        Types.ConfidentialReserve storage reserve,
        euint64 userBorrowBalance,
        Types.ConfidentialUserPosition storage userPosition,
        address user
    ) external returns (euint64 newUserBorrowBalance) {
        if (!reserve.active) revert ProtocolErrors.ReserveNotActive();
        if (!reserve.borrowingEnabled) revert ProtocolErrors.BorrowingNotEnabled();
        if (reserve.isPaused) revert ProtocolErrors.ProtocolPaused();
        if (asset == address(0)) revert ProtocolErrors.ZeroAddress();

        euint64 liquidityCappedAmount = amount.validateAndCap(reserve.availableLiquidity);


        euint64 maxAllowedBorrow = FHE.asEuint64(Constants.MAX_EUINT64);
         if (reserve.borrowCap > 0) {
             euint64 cap = FHE.asEuint64(reserve.borrowCap); 
             euint64 currentTotalBorrowed = reserve.totalBorrowed; 
             euint64 remainingCap = cap.safeSub(currentTotalBorrowed);
             maxAllowedBorrow = remainingCap;
         }
        euint64 finalAmount = liquidityCappedAmount.validateAndCap(maxAllowedBorrow);

        // Initialize user position if needed (cheap operation)
        if (!userPosition.initialized) {
            userPosition.initialized = true;
        }

  
        newUserBorrowBalance = userBorrowBalance.safeAdd(finalAmount);
        reserve.totalBorrowed = reserve.totalBorrowed.safeAdd(finalAmount);
        reserve.availableLiquidity = reserve.availableLiquidity.safeSub(finalAmount);

        FHE.allow(newUserBorrowBalance, user);
        FHE.allowThis(newUserBorrowBalance);
        FHE.allowThis(reserve.totalBorrowed);
        FHE.allowThis(reserve.availableLiquidity);
        FHE.makePubliclyDecryptable(reserve.totalBorrowed);
        FHE.makePubliclyDecryptable(reserve.availableLiquidity);


        FHE.allowTransient(finalAmount, asset);
        ConfidentialFungibleToken(asset).confidentialTransfer(user, finalAmount);

        return newUserBorrowBalance;
    }

    /**
     * @notice Executes a repay operation.
     * @dev Assumes payAmount input is the safe 6-decimal amount to repay
     * @param asset The address of the asset being repaid.
     * @param payAmount The amount to repay (normalized to 6 decimals, already capped).
     * @param reserve Storage pointer to the asset's reserve configuration.
     * @param userBorrowBalance The user's current borrow balance (normalized to 6 decimals).
     * @return newUserBorrowBalance The user's new borrow balance (normalized to 6 decimals).
     */
    function executeRepay(
        address asset,
        euint64 payAmount, 
        Types.ConfidentialReserve storage reserve,
        euint64 userBorrowBalance
    ) external returns (euint64 newUserBorrowBalance) {
        if (!reserve.active) revert ProtocolErrors.ReserveNotActive();
        if (asset == address(0)) revert ProtocolErrors.ZeroAddress();

        FHE.allowTransient(payAmount, asset);
        ConfidentialFungibleToken(asset).confidentialTransferFrom(
            msg.sender,
            address(this),
            payAmount
        );

        newUserBorrowBalance = userBorrowBalance.safeSub(payAmount);
        reserve.totalBorrowed = reserve.totalBorrowed.safeSub(payAmount);
        reserve.availableLiquidity = reserve.availableLiquidity.safeAdd(payAmount);

        FHE.allow(newUserBorrowBalance, msg.sender);
        FHE.allowThis(newUserBorrowBalance);
        FHE.allowThis(reserve.totalBorrowed);
        FHE.allowThis(reserve.availableLiquidity);
        FHE.makePubliclyDecryptable(reserve.availableLiquidity);
        FHE.makePubliclyDecryptable(reserve.totalBorrowed);

        return newUserBorrowBalance;
    }
}