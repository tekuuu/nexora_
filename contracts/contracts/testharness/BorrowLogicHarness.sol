// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @notice Minimal test harness that emulates encrypted values as strings like "encrypted_<value>".
/// It implements simplified reserve and user tracking and exposes test functions used by the JS unit tests.
contract BorrowLogicHarness {
    struct Reserve {
        address underlyingAsset;
        uint256 totalSupplied;
        uint256 totalBorrowed;
        uint256 availableLiquidity;
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

    struct UserPosition {
        bool initialized;
        address currentDebtAsset;
    }

    mapping(address => Reserve) internal reserves;
    mapping(address => mapping(address => uint256)) internal userBorrowBalance; // user => asset => balance
    mapping(address => UserPosition) internal userPositions; // keyed by user

    // Helpers -----------------------------------------------------------------
    function _parseEncryptedHandle(string memory handle) internal pure returns (uint256) {
        bytes memory b = bytes(handle);
        uint256 v = 0;
        bool inNumber = false;
        for (uint256 i = 0; i < b.length; i++) {
            bytes1 ch = b[i];
            if (ch >= 0x30 && ch <= 0x39) {
                inNumber = true;
                v = v * 10 + (uint8(ch) - 48);
            } else {
                if (inNumber) {
                    // continue collecting if more digits appear later
                }
            }
        }
        return v;
    }

    function _uintToString(uint256 v) internal pure returns (string memory) {
        if (v == 0) {
            return "0";
        }
        uint256 temp = v;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (v != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(v % 10)));
            v /= 10;
        }
        return string(buffer);
    }

    function _toEncryptedString(uint256 v) internal pure returns (string memory) {
        return string(abi.encodePacked("encrypted_", _uintToString(v)));
    }

    // Test API ----------------------------------------------------------------

    function executeBorrowTest(
        address asset,
        string calldata encryptedHandle,
        bytes calldata, // inputProof (ignored in harness)
        address user
    ) external returns (string memory) {
        if (asset == address(0)) revert("ZeroAddress");
        Reserve storage r = reserves[asset];
        // initialize defaults for fresh reserve entries
        if (r.underlyingAsset == address(0)) {
            r.underlyingAsset = asset;
            r.active = true;
            r.borrowingEnabled = true;
            r.isCollateral = true;
            r.collateralFactor = 7500;
            r.supplyCap = type(uint64).max;
            r.borrowCap = type(uint64).max;
        }
        if (!r.active) revert("ReserveNotActive");
        if (!r.borrowingEnabled) revert("BorrowingNotEnabled");
        if (r.isPaused) revert("ProtocolPaused");

        uint256 amount = _parseEncryptedHandle(encryptedHandle);
        uint256 liquidityCapped = amount;
        if (liquidityCapped > r.availableLiquidity) liquidityCapped = r.availableLiquidity;

        uint256 maxAllowed = type(uint256).max;
        if (r.borrowCap > 0) {
            if (r.totalBorrowed >= r.borrowCap) {
                maxAllowed = 0;
            } else {
                maxAllowed = r.borrowCap - r.totalBorrowed;
            }
        }

        uint256 finalAmount = liquidityCapped;
        if (finalAmount > maxAllowed) finalAmount = maxAllowed;

        // Initialize user position if needed
        if (!userPositions[user].initialized) {
            userPositions[user].initialized = true;
        }

        userBorrowBalance[user][asset] += finalAmount;
        r.totalBorrowed += finalAmount;
        if (r.availableLiquidity > finalAmount) {
            r.availableLiquidity -= finalAmount;
        } else {
            r.availableLiquidity = 0;
        }

        return _toEncryptedString(userBorrowBalance[user][asset]);
    }

    function executeRepayTest(
        address asset,
        string calldata encryptedHandle,
        bytes calldata,
        address /* user */
    ) external returns (string memory) {
        Reserve storage r = reserves[asset];
        // initialize defaults for fresh reserve entries
        if (r.underlyingAsset == address(0)) {
            r.underlyingAsset = asset;
            r.active = true;
            r.borrowingEnabled = true;
            r.isCollateral = true;
            r.collateralFactor = 7500;
            r.supplyCap = type(uint64).max;
            r.borrowCap = type(uint64).max;
        }
        if (!r.active) revert("ReserveNotActive");
        if (asset == address(0)) revert("ZeroAddress");

        uint256 payAmount = _parseEncryptedHandle(encryptedHandle);

        // subtract capped by current user balance is handled by caller in tests; here we just reduce balances for msg.sender
        uint256 senderBalance = userBorrowBalance[msg.sender][asset];
        uint256 actualRepay = payAmount;
        if (actualRepay > senderBalance) actualRepay = senderBalance;

        if (actualRepay > senderBalance) {
            userBorrowBalance[msg.sender][asset] = 0;
        } else {
            userBorrowBalance[msg.sender][asset] = senderBalance - actualRepay;
        }

        if (r.totalBorrowed > actualRepay) {
            r.totalBorrowed -= actualRepay;
        } else {
            r.totalBorrowed = 0;
        }

        r.availableLiquidity += actualRepay;

        return _toEncryptedString(userBorrowBalance[msg.sender][asset]);
    }

    // Reserve helpers used by tests -------------------------------------------
    function setReserveLiquidityTest(address asset, uint256 amount) external {
        Reserve storage r = reserves[asset];
        r.availableLiquidity = amount;
        r.underlyingAsset = asset;
    }

    // Accepts a config struct with named fields to make calling from tests flexible
    struct ReserveConfigIn {
        uint64 borrowCap;
        uint64 supplyCap;
        uint64 collateralFactor;
        bool borrowingEnabled;
        bool isCollateral;
        bool active;
    }

    function setReserveConfigTest(address asset, ReserveConfigIn calldata config) external {
        Reserve storage r = reserves[asset];
        r.borrowCap = config.borrowCap;
        r.supplyCap = config.supplyCap;
        r.collateralFactor = config.collateralFactor;
        r.borrowingEnabled = config.borrowingEnabled;
        r.isCollateral = config.isCollateral;
        r.active = config.active;
        r.underlyingAsset = asset;
    }

    function setReserveActiveTest(address asset, bool active) external {
        reserves[asset].active = active;
    }

    function setReserveBorrowingEnabledTest(address asset, bool enabled) external {
        reserves[asset].borrowingEnabled = enabled;
    }

    function setReservePausedTest(address asset, bool paused) external {
        reserves[asset].isPaused = paused;
    }

    // Query helpers used by tests ---------------------------------------------
    function getReserveDataTest(address asset)
        external
        view
        returns (
            string memory totalSupplied,
            string memory totalBorrowed,
            string memory availableLiquidity,
            bool active,
            bool borrowingEnabled,
            bool isCollateral,
            uint64 collateralFactor,
            uint64 supplyCap,
            uint64 borrowCap
        )
    {
        Reserve storage r = reserves[asset];
        return (
            _toEncryptedString(r.totalSupplied),
            _toEncryptedString(r.totalBorrowed),
            _toEncryptedString(r.availableLiquidity),
            r.active,
            r.borrowingEnabled,
            r.isCollateral,
            r.collateralFactor,
            r.supplyCap,
            r.borrowCap
        );
    }

    function getUserBorrowBalanceTest(address user, address asset) external view returns (string memory) {
        return _toEncryptedString(userBorrowBalance[user][asset]);
    }

    function getUserPositionTest(address user) external view returns (bool initialized, address currentDebtAsset) {
        UserPosition storage p = userPositions[user];
        return (p.initialized, p.currentDebtAsset);
    }
}
