// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Types} from "../libraries/Types.sol";

interface IConfidentialPoolConfigurator {
    function setLendingPool(address _lendingPool) external;

    function initReserve(
        address asset,
        bool borrowingEnabled,
        bool isCollateral,
        uint64 collateralFactor
    ) external;

    function setReserveActive(address asset, bool active) external;
    function setReserveBorrowing(address asset, bool enabled) external;
    function setReserveCollateral(address asset, bool enabled) external;
    function setCollateralFactor(address asset, uint64 factor) external;

    function getReserveConfig(address asset) external view returns (Types.ConfidentialReserve memory);

    function setSupplyCap(address asset, uint64 cap) external;
    function setBorrowCap(address asset, uint64 cap) external;

    function pauseReserve(address asset) external;
    function unpauseReserve(address asset) external;

    event ReserveInitialized(address indexed asset, bool borrowingEnabled, bool isCollateral);
    event ReserveActiveChanged(address indexed asset, bool active);
    event ReserveBorrowingChanged(address indexed asset, bool enabled);
    event ReserveCollateralChanged(address indexed asset, bool enabled);
    event CollateralFactorUpdated(address indexed asset, uint64 factor);
    event SupplyCapUpdated(address indexed asset, uint64 cap);
    event BorrowCapUpdated(address indexed asset, uint64 cap);
    event ReservePaused(address indexed asset);
    event ReserveUnpaused(address indexed asset);
}