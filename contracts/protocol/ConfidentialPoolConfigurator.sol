// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IConfidentialPoolConfigurator} from "../interfaces/IConfidentialPoolConfigurator.sol";
import {IConfidentialLendingPool} from "../interfaces/IConfidentialLendingPool.sol";
import {IACLManager} from "../interfaces/IACLManager.sol";
import {Types} from "../libraries/Types.sol";
// ReserveLogic removed; inline validations are used
import {Constants} from "../config/Constants.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {FHE} from "@fhevm/solidity/lib/FHE.sol";

contract ConfidentialPoolConfigurator is IConfidentialPoolConfigurator, Ownable {

    IACLManager public immutable aclManager;
    IConfidentialLendingPool public lendingPool;
    
    // Reserve configuration storage
    mapping(address => Types.ConfidentialReserve) public reserves;

    modifier onlyPoolAdmin() {
        require(aclManager.isPoolAdmin(msg.sender), "Only pool admin");
        _;
    }

    modifier onlyRiskAdmin() {
        require(aclManager.isRiskAdmin(msg.sender), "Only risk admin");
        _;
    }

    constructor(address _aclManager) Ownable(msg.sender) {
        aclManager = IACLManager(_aclManager);
    }

    function setLendingPool(address _lendingPool) external onlyPoolAdmin {
        lendingPool = IConfidentialLendingPool(_lendingPool);
    }

    function initReserve(
        address asset,
        bool borrowingEnabled,
        bool isCollateral,
        uint64 collateralFactor
    ) external override onlyPoolAdmin {
        require(address(lendingPool) != address(0), "Lending pool not set");
        require(reserves[asset].underlyingAsset == address(0), "Reserve already initialized");
        require(collateralFactor > 0 && collateralFactor <= Constants.PRECISION, "Invalid collateral factor");

        // Store basic config in Configurator (without encrypted values)
        // The Pool will initialize encrypted values (totalSupplied, totalBorrowed, etc.)
        reserves[asset].underlyingAsset = asset;
        reserves[asset].lastUpdateTimestamp = uint64(block.timestamp);
        reserves[asset].active = true;
        reserves[asset].borrowingEnabled = borrowingEnabled;
        reserves[asset].isCollateral = isCollateral;
        reserves[asset].isPaused = false;
        reserves[asset].collateralFactor = collateralFactor;
        reserves[asset].supplyCap = 0;
        reserves[asset].borrowCap = 0;

        // Forward initialization to lending pool - it will handle FHE values
        lendingPool.initReserve(asset, borrowingEnabled, isCollateral, collateralFactor);

        emit ReserveInitialized(asset, borrowingEnabled, isCollateral);
    }

    function setReserveActive(address asset, bool active) external override onlyPoolAdmin {
        Types.ConfidentialReserve storage r = reserves[asset];
        r.active = active;
        _syncToLendingPool(asset);
        emit ReserveActiveChanged(asset, active);
    }

    function setReserveBorrowing(address asset, bool enabled) external override onlyPoolAdmin {
        Types.ConfidentialReserve storage r = reserves[asset];
        r.borrowingEnabled = enabled;
        _syncToLendingPool(asset);
        emit ReserveBorrowingChanged(asset, enabled);
    }

    function setReserveCollateral(address asset, bool enabled) external override onlyPoolAdmin {
        Types.ConfidentialReserve storage r = reserves[asset];
        r.isCollateral = enabled;
        _syncToLendingPool(asset);
        emit ReserveCollateralChanged(asset, enabled);
    }

    function setCollateralFactor(address asset, uint64 factor) external override onlyRiskAdmin {
        require(factor <= Constants.PRECISION, "Invalid collateral factor");
        Types.ConfidentialReserve storage r = reserves[asset];
        r.collateralFactor = factor;
        _syncToLendingPool(asset);
        emit CollateralFactorUpdated(asset, factor);
    }

    function getReserveConfig(address asset) external view returns (Types.ConfidentialReserve memory) {
        return reserves[asset];
    }

    function setSupplyCap(address asset, uint64 cap) external onlyRiskAdmin {
        Types.ConfidentialReserve storage r = reserves[asset];
        r.supplyCap = cap;
        _syncToLendingPool(asset);
        emit SupplyCapUpdated(asset, cap);
    }

    function setBorrowCap(address asset, uint64 cap) external onlyRiskAdmin {
        Types.ConfidentialReserve storage r = reserves[asset];
        r.borrowCap = cap;
        _syncToLendingPool(asset);
        emit BorrowCapUpdated(asset, cap);
    }

    function pauseReserve(address asset) external onlyRiskAdmin {
        reserves[asset].isPaused = true;
        emit ReservePaused(asset);
    }

    function unpauseReserve(address asset) external onlyRiskAdmin {
        reserves[asset].isPaused = false;
        emit ReserveUnpaused(asset);
    }

    function _syncToLendingPool(address asset) internal {
        Types.ConfidentialReserve storage r = reserves[asset];
        lendingPool.updateReserveConfig(
            asset,
            r.active,
            r.borrowingEnabled,
            r.isCollateral,
            r.collateralFactor,
            r.supplyCap,
            r.borrowCap
        );
    }
}
