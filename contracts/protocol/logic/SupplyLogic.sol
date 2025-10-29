// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ... (Imports remain the same, including euint128 for intermediate calcs)
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
    using FHE for euint128; // Needed for intermediate calculations
    using SafeFHEOperations for euint64;
    using SafeMath64 for uint64;

    event SupplyExecuted(address indexed user, address indexed asset, uint64 timestamp);
    event WithdrawExecuted(address indexed user, address indexed asset, uint64 timestamp);

    function executeSupply(
        address asset,
        externalEuint64 encryptedAmountE6,
        bytes calldata inputProof,
        Types.ConfidentialReserve storage reserve,
        euint64 userBalanceE6,
        Types.ConfidentialUserPosition storage userPosition // Keep even if simplified
    ) external returns (euint64 newUserBalanceE6) {
        require(reserve.active, Errors.RESERVE_NOT_ACTIVE);
        require(!reserve.isPaused, Errors.PROTOCOL_PAUSED);
        require(asset != address(0), Errors.ZERO_ADDRESS);

        euint64 amountE6 = FHE.fromExternal(encryptedAmountE6, inputProof);

        // --- Supply Cap Check ---
        euint64 maxAllowedAmountE6 = FHE.asEuint64(Constants.MAX_EUINT64);
        if (reserve.supplyCap > 0) {
             euint64 currentTotalSupplyE6 = reserve.totalSupplied; // Assuming totalSupplied is also E6
             euint64 capE6 = FHE.asEuint64(reserve.supplyCap);
             euint64 remainingCap = capE6.safeSub(currentTotalSupplyE6);
             maxAllowedAmountE6 = remainingCap;
        }
        euint64 finalAmountE6_beforeOverflowCheck = amountE6.validateAndCap(maxAllowedAmountE6);
        // ------------------------

        // --- De-normalization for Transfer ---
        uint8 nativeDecimals = reserve.decimals;
        uint64 internalFactor = Constants.VALUE_PRECISION_FACTOR; // 1e6
        uint128 nativeFactor = uint128(10) ** uint128(nativeDecimals);
        euint128 intermediate = FHE.asEuint128(finalAmountE6_beforeOverflowCheck);
        intermediate = FHE.mul(intermediate, nativeFactor);
        euint128 nativeAmount128 = FHE.div(intermediate, internalFactor);

        // Safely cast down to euint64 for transfer
        euint128 max64 = FHE.asEuint128(uint128(type(uint64).max));
        ebool fitsIn64 = FHE.le(nativeAmount128, max64);
        euint64 nativeTransferAmount = FHE.asEuint64(nativeAmount128);
        // If it doesn't fit, nativeTransferAmount becomes 0
        nativeTransferAmount = FHE.select(fitsIn64, nativeTransferAmount, FHE.asEuint64(0));

        // *** CORRECTION: Use FHE.select based on fitsIn64 ***
        // If de-normalization overflowed (fitsIn64 is false), set finalAmountE6 to 0
        euint64 finalAmountE6 = FHE.select(fitsIn64, finalAmountE6_beforeOverflowCheck, FHE.asEuint64(0));
        // ------------------------------------

        if (!userPosition.initialized) {
            userPosition.initialized = true;
        }

        // Only transfer if the final amount (after overflow checks) is > 0
        ebool shouldTransfer = finalAmountE6.gt(FHE.asEuint64(0));
        euint64 amountToTransfer = FHE.select(shouldTransfer, nativeTransferAmount, FHE.asEuint64(0));

        FHE.allowTransient(amountToTransfer, asset);
        ConfidentialFungibleToken(asset).confidentialTransferFrom(
            msg.sender,
            address(this),
            amountToTransfer // Use the calculated native amount
        );

        // Update internal 6-decimal balances using finalAmountE6 (which is 0 if overflow occurred)
        newUserBalanceE6 = userBalanceE6.safeAdd(finalAmountE6);
        reserve.totalSupplied = reserve.totalSupplied.safeAdd(finalAmountE6);
        reserve.availableLiquidity = reserve.availableLiquidity.safeAdd(finalAmountE6);

        // Grant ACL permissions (using 6-decimal balances)
        FHE.allow(newUserBalanceE6, msg.sender);
        FHE.allowThis(newUserBalanceE6);
        FHE.allowThis(reserve.totalSupplied);
        FHE.allowThis(reserve.availableLiquidity);

        emit SupplyExecuted(msg.sender, asset, uint64(block.timestamp));
        return newUserBalanceE6;
    }


    function executeWithdraw(
        address asset,
        euint64 withdrawAmountE6, // Assume this is the final, approved 6-decimal amount
        Types.ConfidentialReserve storage reserve,
        euint64 userBalanceE6,
        address user
    ) external returns (euint64 newUserBalanceE6) {
        require(reserve.active, Errors.RESERVE_NOT_ACTIVE);
        require(!reserve.isPaused, Errors.PROTOCOL_PAUSED);
        require(asset != address(0), Errors.ZERO_ADDRESS);

        euint64 finalAmountE6_beforeOverflowCheck = withdrawAmountE6;

        // --- De-normalization for Transfer ---
        uint8 nativeDecimals = reserve.decimals;
        uint64 internalFactor = Constants.VALUE_PRECISION_FACTOR; // 1e6
        uint128 nativeFactor = uint128(10) ** uint128(nativeDecimals);
        euint128 intermediate = FHE.asEuint128(finalAmountE6_beforeOverflowCheck);
        intermediate = FHE.mul(intermediate, nativeFactor);
        euint128 nativeAmount128 = FHE.div(intermediate, internalFactor);

        // Safely cast down to euint64 for transfer
        euint128 max64 = FHE.asEuint128(uint128(type(uint64).max));
        ebool fitsIn64 = FHE.le(nativeAmount128, max64);
        euint64 nativeTransferAmount = FHE.asEuint64(nativeAmount128);
        nativeTransferAmount = FHE.select(fitsIn64, nativeTransferAmount, FHE.asEuint64(0));

        // *** CORRECTION: Use FHE.select based on fitsIn64 ***
        // If de-normalization overflowed (fitsIn64 is false), set finalAmountE6 to 0
        euint64 finalAmountE6 = FHE.select(fitsIn64, finalAmountE6_beforeOverflowCheck, FHE.asEuint64(0));
        // ------------------------------------

        // Update internal 6-decimal balances first using finalAmountE6
        newUserBalanceE6 = userBalanceE6.safeSub(finalAmountE6);
        reserve.totalSupplied = reserve.totalSupplied.safeSub(finalAmountE6);
        reserve.availableLiquidity = reserve.availableLiquidity.safeSub(finalAmountE6);

        // Grant ACL permissions
        FHE.allow(newUserBalanceE6, user);
        FHE.allowThis(newUserBalanceE6);
        FHE.allowThis(reserve.totalSupplied);
        FHE.allowThis(reserve.availableLiquidity);

        // Only transfer if the final amount (after overflow checks) is > 0
        ebool shouldTransfer = finalAmountE6.gt(FHE.asEuint64(0));
        euint64 amountToTransfer = FHE.select(shouldTransfer, nativeTransferAmount, FHE.asEuint64(0));

        FHE.allowTransient(amountToTransfer, asset);
        ConfidentialFungibleToken(asset).confidentialTransfer(
            user,
            amountToTransfer // Use the calculated native amount
        );

        emit WithdrawExecuted(user, asset, uint64(block.timestamp));
        return newUserBalanceE6;
    }
}