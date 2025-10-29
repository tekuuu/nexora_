// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, euint128} from "@fhevm/solidity/lib/FHE.sol";

library Types {

    /**
     * @notice Stores the configuration for a single reserve.
     */
    struct ConfidentialReserve {
        address underlyingAsset;
        euint64 totalSupplied;      // Stores 6-decimal normalized amount
        euint64 totalBorrowed;      // Stores 6-decimal normalized amount
        euint64 availableLiquidity; // Stores 6-decimal normalized amount
        uint64 lastUpdateTimestamp;
        bool active;
        bool borrowingEnabled;
        bool isCollateral;
        bool isPaused;
        uint64 collateralFactor; // Stores basis points (e.g., 7500)
        uint64 supplyCap;        // Stores 6-decimal normalized amount cap
        uint64 borrowCap;        // Stores 6-decimal normalized amount cap
        uint8 decimals;           // Stores the *native* decimals (e.g., 18 for WETH) - CRITICAL
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
        euint64 withdrawAmount; // This will be the 6-decimal normalized amount
        euint64 userBalance;    // This will be the 6-decimal normalized balance
        bytes inputProof;
        address user;
    }

} 