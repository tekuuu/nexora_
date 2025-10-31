// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// Minimal mock used by configurator tests. Intentionally does NOT implement the
// full IConfidentialLendingPool interface to avoid needing FHE types in the
// mock. It exposes the configurator-facing functions used in tests.
contract MockConfidentialLendingPool {
    struct InitReserveCall {
        bool called;
        address asset;
        bool borrowingEnabled;
        bool isCollateral;
        uint64 collateralFactor;
    }

    struct UpdateConfigCall {
        bool called;
        address asset;
        bool active;
        bool borrowingEnabled;
        bool isCollateral;
        uint64 collateralFactor;
        uint64 supplyCap;
        uint64 borrowCap;
    }

    mapping(address => InitReserveCall) public initReserveCalls;
    mapping(address => UpdateConfigCall) public updateConfigCalls;

    uint256 public initReserveCallCount;
    uint256 public updateConfigCallCount;

    function initReserve(address asset, bool borrowingEnabled, bool isCollateral, uint64 collateralFactor) external {
        initReserveCalls[asset] = InitReserveCall({
            called: true,
            asset: asset,
            borrowingEnabled: borrowingEnabled,
            isCollateral: isCollateral,
            collateralFactor: collateralFactor
        });
        initReserveCallCount++;
    }

    function updateReserveConfig(
        address asset,
        bool active,
        bool borrowingEnabled,
        bool isCollateral,
        uint64 collateralFactor,
        uint64 supplyCap,
        uint64 borrowCap
    ) external {
        updateConfigCalls[asset] = UpdateConfigCall({
            called: true,
            asset: asset,
            active: active,
            borrowingEnabled: borrowingEnabled,
            isCollateral: isCollateral,
            collateralFactor: collateralFactor,
            supplyCap: supplyCap,
            borrowCap: borrowCap
        });
        updateConfigCallCount++;
    }

    // Helper view functions
    function wasInitReserveCalled(address asset) external view returns (bool) {
        return initReserveCalls[asset].called;
    }

    function wasUpdateConfigCalled(address asset) external view returns (bool) {
        return updateConfigCalls[asset].called;
    }

    function getInitReserveCall(address asset) external view returns (InitReserveCall memory) {
        return initReserveCalls[asset];
    }

    function getUpdateConfigCall(address asset) external view returns (UpdateConfigCall memory) {
        return updateConfigCalls[asset];
    }

    // The mock intentionally omits other expensive or FHE-specific functions.

    // Added to support configurator pause/unpause sync in tests
    function setReservePaused(address /*asset*/, bool /*isPaused_*/) external {}
}
