// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Imports (Ensure these paths are correct and files are updated)
import {Types} from "../../libraries/Types.sol";
import {Errors} from "../../libraries/Errors.sol";
import {Constants} from "../../config/Constants.sol"; // Assumes updated Constants.sol
import {SafeFHEOperations} from "../../libraries/SafeFHEOperations.sol"; // Use euint64 utils
import {SafeMath64} from "../../libraries/SafeMath64.sol";
import {ConfidentialFungibleToken} from "@openzeppelin/confidential-contracts/token/ConfidentialFungibleToken.sol";
// Import euint128 specifically for de-normalization overflow protection
import {FHE, euint64, ebool, externalEuint64, euint128} from "@fhevm/solidity/lib/FHE.sol";

/**
 * @title BorrowLogic (Refactored for 6-Decimal euint64 V0+)
 * @notice Handles borrow and repayment logic, including de-normalization for transfers.
 * @dev All internal euint64 balances represent amounts normalized to 6 decimals.
 */
library BorrowLogic {
    using FHE for euint64;
    using FHE for ebool;
    using FHE for euint128; // Needed for intermediate calculations
    using SafeFHEOperations for euint64;
    using SafeMath64 for uint64;

    /**
     * @notice Executes a borrow operation.
     * @dev Assumes amountE6 input is the final, approved 6-decimal amount. De-normalizes for transfer.
     * @param asset The address of the asset being borrowed.
     * @param amountE6 The amount to borrow (normalized to 6 decimals).
     * @param reserve Storage pointer to the asset's reserve configuration.
     * @param userBorrowBalanceE6 The user's current borrow balance (normalized to 6 decimals).
     * @param userPosition Storage pointer to the user's position data (used for initialization check).
     * @param user The address of the user performing the borrow.
     * @return newUserBorrowBalanceE6 The user's new borrow balance (normalized to 6 decimals).
     */
    function executeBorrow(
        address asset,
        euint64 amountE6, // Receive the 6-decimal approved amount
        Types.ConfidentialReserve storage reserve,
        euint64 userBorrowBalanceE6, // Internal state is 6-decimal
        Types.ConfidentialUserPosition storage userPosition,
        address user
    ) external returns (euint64 newUserBorrowBalanceE6) { // Return 6-decimal state
        require(reserve.active, Errors.RESERVE_NOT_ACTIVE);
        require(reserve.borrowingEnabled, Errors.BORROWING_NOT_ENABLED);
        require(!reserve.isPaused, Errors.PROTOCOL_PAUSED);
        require(asset != address(0), Errors.ZERO_ADDRESS);

        // --- Cap Checks (using 6-decimal values) ---
        // 1. Cap by available liquidity (stored as 6-decimal)
        euint64 liquidityCappedAmountE6 = amountE6.validateAndCap(reserve.availableLiquidity);

        // 2. Cap by reserve's borrow cap (stored as 6-decimal)
        euint64 maxAllowedBorrowE6 = FHE.asEuint64(Constants.MAX_EUINT64);
         if (reserve.borrowCap > 0) {
             euint64 capE6 = FHE.asEuint64(reserve.borrowCap); // Cap is already 6-decimal
             euint64 currentTotalBorrowedE6 = reserve.totalBorrowed; // Total borrowed is 6-decimal
             euint64 remainingCap = capE6.safeSub(currentTotalBorrowedE6);
             maxAllowedBorrowE6 = remainingCap;
         }
        euint64 finalAmountE6_beforeOverflowCheck = liquidityCappedAmountE6.validateAndCap(maxAllowedBorrowE6);
        // ------------------------------------------

        // --- De-normalization for Transfer ---
        uint8 nativeDecimals = reserve.decimals; // Get actual NATIVE decimals (e.g., 18)
        uint64 internalFactor = Constants.VALUE_PRECISION_FACTOR; // 1e6

        // Calculate nativeAmount = (finalAmountE6 * 10^native) / 10^6
        uint128 nativeFactor = uint128(10)**uint128(nativeDecimals);
        euint128 intermediate = FHE.asEuint128(finalAmountE6_beforeOverflowCheck); // Cast up for safety
        intermediate = FHE.mul(intermediate, nativeFactor); // Multiply
        euint128 nativeAmount128 = FHE.div(intermediate, internalFactor); // Divide by 1e6

        // Safely cast down to euint64 for transfer
        euint128 max64 = FHE.asEuint128(uint128(type(uint64).max));
        ebool fitsIn64 = FHE.le(nativeAmount128, max64); // Check if native amount fits in euint64
        euint64 nativeTransferAmount = FHE.asEuint64(nativeAmount128);
        // If it doesn't fit, nativeTransferAmount becomes 0
        nativeTransferAmount = FHE.select(fitsIn64, nativeTransferAmount, FHE.asEuint64(0));

        // If de-normalization overflowed (fitsIn64 is false), set finalAmountE6 to 0 for state updates
        euint64 finalAmountE6 = FHE.select(fitsIn64, finalAmountE6_beforeOverflowCheck, FHE.asEuint64(0));
        // ------------------------------------

        // Initialize user position if needed (cheap operation)
        if (!userPosition.initialized) {
            userPosition.initialized = true;
        }

        // Update internal 6-decimal balances using finalAmountE6 (which is 0 if overflow occurred)
        newUserBorrowBalanceE6 = userBorrowBalanceE6.safeAdd(finalAmountE6);
        reserve.totalBorrowed = reserve.totalBorrowed.safeAdd(finalAmountE6);
        reserve.availableLiquidity = reserve.availableLiquidity.safeSub(finalAmountE6);

        // Grant ACL permissions (using 6-decimal balances)
        FHE.allow(newUserBorrowBalanceE6, user);
        FHE.allowThis(newUserBorrowBalanceE6);
        FHE.allowThis(reserve.totalBorrowed);
        FHE.allowThis(reserve.availableLiquidity);

        // Only transfer if the final amount (after overflow checks) is > 0
        ebool shouldTransfer = finalAmountE6.gt(FHE.asEuint64(0));
        euint64 amountToTransfer = FHE.select(shouldTransfer, nativeTransferAmount, FHE.asEuint64(0));

        // Transfer the calculated *native* amount
        FHE.allowTransient(amountToTransfer, asset);
        ConfidentialFungibleToken(asset).confidentialTransfer(user, amountToTransfer);

        // Return the updated 6-decimal balance
        return newUserBorrowBalanceE6;
    }

    /**
     * @notice Executes a repay operation.
     * @dev Assumes payAmountE6 input is the safe 6-decimal amount to repay. De-normalizes for transfer.
     * @param asset The address of the asset being repaid.
     * @param payAmountE6 The amount to repay (normalized to 6 decimals, already capped).
     * @param reserve Storage pointer to the asset's reserve configuration.
     * @param userBorrowBalanceE6 The user's current borrow balance (normalized to 6 decimals).
     * @return newUserBorrowBalanceE6 The user's new borrow balance (normalized to 6 decimals).
     */
    function executeRepay(
        address asset,
        euint64 payAmountE6, // Assume this is the 6-decimal safe amount to repay
        Types.ConfidentialReserve storage reserve,
        euint64 userBorrowBalanceE6 // Internal state is 6-decimal
    ) external returns (euint64 newUserBorrowBalanceE6) { // Return 6-decimal state
        require(reserve.active, Errors.RESERVE_NOT_ACTIVE);
        require(asset != address(0), Errors.ZERO_ADDRESS);

        euint64 finalAmountE6_beforeOverflowCheck = payAmountE6; // Already capped by caller

        // --- De-normalization for Transfer ---
        uint8 nativeDecimals = reserve.decimals; // Get actual NATIVE decimals (e.g., 18)
        uint64 internalFactor = Constants.VALUE_PRECISION_FACTOR; // 1e6

        // Calculate nativeAmount = (finalAmountE6 * 10^native) / 10^6
        uint128 nativeFactor = uint128(10)**uint128(nativeDecimals);
        euint128 intermediate = FHE.asEuint128(finalAmountE6_beforeOverflowCheck);
        intermediate = FHE.mul(intermediate, nativeFactor);
        euint128 nativeAmount128 = FHE.div(intermediate, internalFactor);

        // Safely cast down to euint64 for transfer
        euint128 max64 = FHE.asEuint128(uint128(type(uint64).max));
        ebool fitsIn64 = FHE.le(nativeAmount128, max64);
        euint64 nativeTransferAmount = FHE.asEuint64(nativeAmount128);
        nativeTransferAmount = FHE.select(fitsIn64, nativeTransferAmount, FHE.asEuint64(0));

        // If de-normalization overflowed, set finalAmountE6 to 0 for state updates
        euint64 finalAmountE6 = FHE.select(fitsIn64, finalAmountE6_beforeOverflowCheck, FHE.asEuint64(0));
        // ------------------------------------

        // Only transfer if the final amount (after overflow checks) is > 0
        ebool shouldTransfer = finalAmountE6.gt(FHE.asEuint64(0));
        euint64 amountToTransfer = FHE.select(shouldTransfer, nativeTransferAmount, FHE.asEuint64(0));

        // Transfer the calculated *native* amount from user to contract
        FHE.allowTransient(amountToTransfer, asset);
        ConfidentialFungibleToken(asset).confidentialTransferFrom(
            msg.sender,
            address(this),
            amountToTransfer // Use native amount
        );

        // Update internal 6-decimal balances using finalAmountE6
        newUserBorrowBalanceE6 = userBorrowBalanceE6.safeSub(finalAmountE6);
        reserve.totalBorrowed = reserve.totalBorrowed.safeSub(finalAmountE6);
        reserve.availableLiquidity = reserve.availableLiquidity.safeAdd(finalAmountE6);

        // Grant ACL permissions (using 6-decimal balances)
        FHE.allow(newUserBorrowBalanceE6, msg.sender);
        FHE.allowThis(newUserBorrowBalanceE6);
        FHE.allowThis(reserve.totalBorrowed);
        FHE.allowThis(reserve.availableLiquidity);

        return newUserBorrowBalanceE6;
    }
}