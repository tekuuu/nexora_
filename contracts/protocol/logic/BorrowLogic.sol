// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Types} from "../../libraries/Types.sol";
import {Errors} from "../../libraries/Errors.sol";
import {Constants} from "../../config/Constants.sol";
import {SafeFHEOperations} from "../../libraries/SafeFHEOperations.sol";
import {SafeMath64} from "../../libraries/SafeMath64.sol";
import {ConfidentialFungibleToken} from "@openzeppelin/confidential-contracts/token/ConfidentialFungibleToken.sol";
import {FHE, euint64, ebool, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";

library BorrowLogic {
    using FHE for euint64;
    using FHE for ebool;
    using SafeFHEOperations for euint64;
    using SafeMath64 for uint64;


    function executeBorrow(
        address asset,
        euint64 borrowAmount,
        Types.ConfidentialReserve storage reserve,
        euint64 userBorrowBalance,
        Types.ConfidentialUserPosition storage userPosition,
        address user
    ) external returns (euint64) {
        require(reserve.active, Errors.RESERVE_NOT_ACTIVE);
        require(reserve.borrowingEnabled, Errors.BORROWING_NOT_ENABLED);
        require(!reserve.isPaused, Errors.PROTOCOL_PAUSED);
        require(asset != address(0), Errors.ZERO_ADDRESS);
    
        
        // Check if we have any borrow capacity after collateral cap
        //ebool hasBorrowCapacity = borrowAmount.gt(FHE.asEuint64(0));            
        // Only proceed if we have borrow capacity
        //euint64 safeAmount = FHE.select(hasBorrowCapacity, borrowAmount, FHE.asEuint64(0));
        
        // Cap by on-chain available liquidity first
        euint64 liquidityCappedAmount = borrowAmount.validateAndCap(reserve.availableLiquidity);

        // Simple borrowCap handling (mirrors SupplyLogic style): cap per-tx against borrowCap (in token units)
        euint64 maxAllowedBorrow = FHE.asEuint64(type(uint64).max);
        if (reserve.borrowCap > 0) {
            uint8 tokenDecimals = ConfidentialFungibleToken(asset).decimals();
            uint64 logicalTokens = reserve.borrowCap.div(Constants.PRECISION);
            uint64 capInTokenUnits = logicalTokens.mul(uint64(10 ** tokenDecimals));
            maxAllowedBorrow = FHE.asEuint64(capInTokenUnits);
        }
        euint64 finalAmount = liquidityCappedAmount.validateAndCap(maxAllowedBorrow);
        
        // Update balances with safe operations
        userBorrowBalance = userBorrowBalance.safeAdd(finalAmount);
        reserve.totalBorrowed = reserve.totalBorrowed.safeAdd(finalAmount);
        reserve.availableLiquidity = reserve.availableLiquidity.safeSub(finalAmount);

        // Initialize user position if needed
        if (!userPosition.initialized) {
            userPosition.initialized = true;
        }

        // Grant ACL permissions
        FHE.allow(userBorrowBalance, user);
        FHE.allowThis(userBorrowBalance);
        FHE.allowThis(reserve.totalBorrowed);
        FHE.allowThis(reserve.availableLiquidity);

        // CRITICAL: Pool must be operator of the asset token to transfer from its own balance
        // The transfer fails because Pool is transferring FROM itself TO user
        // This is different from supply (user→pool via transferFrom with approval)
        FHE.allowTransient(finalAmount, asset);
        ConfidentialFungibleToken(asset).confidentialTransfer(user, finalAmount);
        
        return userBorrowBalance;
    }


    function executeRepay(
        address asset,
        euint64 payAmount,
        Types.ConfidentialReserve storage reserve,
        euint64 userBorrowBalance
    ) external returns (euint64) {
        require(reserve.active, Errors.RESERVE_NOT_ACTIVE);
        require(asset != address(0), Errors.ZERO_ADDRESS);
        
        FHE.allowTransient(payAmount, asset);
        ConfidentialFungibleToken(asset).confidentialTransferFrom(msg.sender, address(this), payAmount);

        userBorrowBalance = userBorrowBalance.safeSub(payAmount);
        reserve.totalBorrowed = reserve.totalBorrowed.safeSub(payAmount);
        reserve.availableLiquidity = reserve.availableLiquidity.safeAdd(payAmount);
        
        // Grant ACL permissions to user (FHEVM Sepolia requirement)
        FHE.allow(userBorrowBalance, msg.sender);
        
        // 🔧 CRITICAL FIX: Allow pool to read user balance for future operations
        FHE.allowThis(userBorrowBalance);
        
        // Allow protocol to read its own reserve totals
        FHE.allowThis(reserve.totalBorrowed);
        FHE.allowThis(reserve.availableLiquidity);

        return userBorrowBalance;
    }
}
