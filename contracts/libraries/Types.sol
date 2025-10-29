// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {euint64, euint128} from "@fhevm/solidity/lib/FHE.sol";

library Types {
    /**
     * @notice Reserve configuration and state for a lending asset
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
     * @title Types.ConfidentialUserPosition
     * @notice Holds the central accounting state for a single user.
     * @dev This struct is optimized to prevent loops during margin checks
     * by tracking normalized USD totals directly.
     */
    struct ConfidentialUserPosition {
        euint128 totalBorrowPowerUSD;
        euint128 totalDebtUSD;

        // For frontend/profile UI
        euint128 totalSuppliedUSD;
        
        address[] collateralAssets;
        address[] borrowedAssets;

        bool initialized;
    }
    struct ExecuteSupplyParams {
        address asset;
        euint64 amount;                // In token decimals
        address onBehalfOf;
    }

    struct ExecuteWithdrawParams {
        address asset;
        euint64 amount;                // In token decimals
        address to;
    }

    // NEW: Withdraw parameters struct to avoid stack depth issues
    struct WithdrawParams {
        address asset;
        euint64 withdrawAmount;        // In token decimals
        euint64 userBalance;           // In token decimals
        bytes inputProof;
        address user;                  // Track user for access control
    }
}
