// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint64, euint128} from "@fhevm/solidity/lib/FHE.sol";

library Types {

    /**
     * @notice Stores the configuration for a single reserve.
     */
    struct ConfidentialReserve {
        address underlyingAsset;
        euint64 totalSupplied; 
        euint64 totalBorrowed;      
        euint64 availableLiquidity; 
        uint64 lastUpdateTimestamp;
        bool active;
        bool borrowingEnabled;
        bool isCollateral;
        bool isPaused;
        uint64 collateralFactor; 
        uint64 supplyCap;        
        uint64 borrowCap;        
        uint8 decimals;        
    }

    /**
     * @notice Holds state for a single user in the V0+ model.
     */
    struct ConfidentialUserPosition {
        bool initialized;
        address currentDebtAsset;
    }

    /**
     * @notice Parameters struct for withdrawal operations.
     */
    struct WithdrawParams {
        address asset;
        euint64 withdrawAmount; 
        euint64 userBalance;  
        bytes inputProof;
        address user;
    }

} 