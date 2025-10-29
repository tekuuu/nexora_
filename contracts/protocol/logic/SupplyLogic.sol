// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Types} from "../../libraries/Types.sol";
import {Errors} from "../../libraries/Errors.sol";
import {Constants} from "../../config/Constants.sol";
import {SafeFHEOperations} from "../../libraries/SafeFHEOperations.sol";
import {SafeMath64} from "../../libraries/SafeMath64.sol";
import {ConfidentialFungibleToken} from "@openzeppelin/confidential-contracts/token/ConfidentialFungibleToken.sol";
import {FHE, euint64, ebool, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";

library SupplyLogic {
    using FHE for euint64;
    using FHE for ebool;
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
    ) external returns (euint64) {
        require(reserve.active, Errors.RESERVE_NOT_ACTIVE);
        require(!reserve.isPaused, Errors.PROTOCOL_PAUSED);
        require(asset != address(0), Errors.ZERO_ADDRESS);
        
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);
        

        euint64 maxAllowedAmount = FHE.asEuint64(type(uint64).max);
        if (reserve.supplyCap > 0) {
  
            uint8 tokenDecimals = ConfidentialFungibleToken(asset).decimals();
            uint64 logicalTokens = reserve.supplyCap.div(Constants.PRECISION);
            uint64 capInTokenUnits = logicalTokens.mul(uint64(10 ** tokenDecimals));
            
            maxAllowedAmount = FHE.asEuint64(capInTokenUnits);
        }
        euint64 safeAmount = amount.validateAndCap(maxAllowedAmount);
        
        if (!userPosition.initialized) {
            userPosition.initialized = true;
        }
        
        FHE.allowTransient(safeAmount, asset);
        ConfidentialFungibleToken(asset).confidentialTransferFrom(
            msg.sender,
            address(this),
            safeAmount
        );
        
        // Update balances with safe operations (overflow protection)
        userBalance = userBalance.safeAdd(safeAmount);
        reserve.totalSupplied = reserve.totalSupplied.safeAdd(safeAmount);
        reserve.availableLiquidity = reserve.availableLiquidity.safeAdd(safeAmount);

        // Grant ACL permissions to user (FHEVM Sepolia requirement)
        FHE.allow(userBalance, msg.sender);
        
        // 🔧 CRITICAL FIX: Allow pool to read user balance for future operations
        FHE.allowThis(userBalance);
        
        // Allow protocol to read its own reserve totals
        FHE.allowThis(reserve.totalSupplied);
        FHE.allowThis(reserve.availableLiquidity);
        
        return userBalance;
    }




    function executeWithdraw(
        address asset,
        euint64 withdrawAmount,
        Types.ConfidentialReserve storage reserve,
        euint64 userBalance,
        address user
    ) external returns (euint64) {
        require(reserve.active, Errors.RESERVE_NOT_ACTIVE);
        require(!reserve.isPaused, Errors.PROTOCOL_PAUSED);
        require(asset != address(0), Errors.ZERO_ADDRESS);
        

        // Update balances first (CEI pattern)
        userBalance = userBalance.safeSub(withdrawAmount);
        reserve.totalSupplied = reserve.totalSupplied.safeSub(withdrawAmount);
        reserve.availableLiquidity = reserve.availableLiquidity.safeSub(withdrawAmount);

        // Grant ACL permissions
        FHE.allow(userBalance, user);
        FHE.allowThis(userBalance);
        FHE.allowThis(reserve.totalSupplied);
        FHE.allowThis(reserve.availableLiquidity);

        // Transfer tokens back to user
        FHE.allowTransient(withdrawAmount, asset);
        ConfidentialFungibleToken(asset).confidentialTransfer(user, withdrawAmount );
    
        return userBalance;
    }
}
