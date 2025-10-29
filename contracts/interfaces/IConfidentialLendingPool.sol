// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {Types} from "../libraries/Types.sol";

interface IConfidentialLendingPool {
    // User operations
    function supply(
        address asset,
        externalEuint64 amount,
        bytes calldata inputProof
    ) external;

    function withdraw(
        address asset,
        externalEuint64 amount,
        bytes calldata inputProof
    ) external;

    function borrow(
        address asset, 
        externalEuint64 amount,
        bytes calldata inputProof
    ) external;

    function repay(
        address asset,
        externalEuint64 amount,
        bytes calldata inputProof
    ) external;

    // Per-user collateral toggle
    function setUserUseReserveAsCollateral(address asset, bool useAsCollateral) external;

    // Configuration functions (called by configurator)
    function initReserve(
        address asset,
        bool borrowingEnabled,
        bool isCollateral,
        uint64 collateralFactor
    ) external;

    function updateReserveConfig(
        address asset,
        bool active,
        bool borrowingEnabled,
        bool isCollateral,
        uint64 collateralFactor,
        uint64 supplyCap,
        uint64 borrowCap
    ) external;

    // View functions
    function getUserSuppliedBalance(address user, address asset) external view returns (euint64);
    function getUserBorrowedBalance(address user, address asset) external view returns (euint64);
    function getUserPosition(address user) external view returns (Types.ConfidentialUserPosition memory);

    // Events
    event Supply(address indexed reserve, address indexed user);
    event Withdraw(address indexed reserve, address indexed user);
    event Borrow(address indexed reserve, address indexed user);
    event Repay(address indexed reserve, address indexed user);
}
