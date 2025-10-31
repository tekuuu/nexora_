// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

contract SupplyLogicHarness {
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
    mapping(address => mapping(address => uint256)) internal userBalance; // user => asset => balance
    mapping(address => UserPosition) internal userPositions;

    event SupplyExecuted(address indexed user, address indexed asset, uint64 timestamp);
    event WithdrawExecuted(address indexed user, address indexed asset, uint64 timestamp);

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
                    // continue
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
    function executeSupplyTest(
        address asset,
        string calldata encryptedHandle,
        bytes calldata,
        address /* user */
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
        if (r.isPaused) revert("ProtocolPaused");

        uint256 amount = _parseEncryptedHandle(encryptedHandle);

        uint256 maxAllowed = type(uint256).max;
        if (r.supplyCap > 0) {
            if (r.totalSupplied >= r.supplyCap) {
                maxAllowed = 0;
            } else {
                maxAllowed = r.supplyCap - r.totalSupplied;
            }
        }

        uint256 finalAmount = amount;
        if (finalAmount > maxAllowed) finalAmount = maxAllowed;

        if (!userPositions[msg.sender].initialized) {
            userPositions[msg.sender].initialized = true;
        }

        userBalance[msg.sender][asset] += finalAmount;
        r.totalSupplied += finalAmount;
        r.availableLiquidity += finalAmount;

        emit SupplyExecuted(msg.sender, asset, uint64(block.timestamp));

        return _toEncryptedString(userBalance[msg.sender][asset]);
    }

    function executeWithdrawTest(
        address asset,
        string calldata encryptedHandle,
        bytes calldata,
        address user
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
        if (r.isPaused) revert("ProtocolPaused");
        if (asset == address(0)) revert("ZeroAddress");

        uint256 withdrawAmount = _parseEncryptedHandle(encryptedHandle);
        uint256 bal = userBalance[user][asset];
        uint256 finalAmount = withdrawAmount;
        if (finalAmount > bal) finalAmount = bal;

        if (bal > finalAmount) {
            userBalance[user][asset] = bal - finalAmount;
        } else {
            userBalance[user][asset] = 0;
        }

        if (r.totalSupplied > finalAmount) {
            r.totalSupplied -= finalAmount;
        } else {
            r.totalSupplied = 0;
        }

        if (r.availableLiquidity > finalAmount) {
            r.availableLiquidity -= finalAmount;
        } else {
            r.availableLiquidity = 0;
        }

        emit WithdrawExecuted(user, asset, uint64(block.timestamp));
        return _toEncryptedString(userBalance[user][asset]);
    }

    // Reserve helpers ---------------------------------------------------------
    function setReserveLiquidityTest(address asset, uint256 amount) external {
        Reserve storage r = reserves[asset];
        r.availableLiquidity = amount;
        r.underlyingAsset = asset;
    }

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

    function setReservePausedTest(address asset, bool paused) external {
        reserves[asset].isPaused = paused;
    }

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

    function getUserBalanceTest(address user, address asset) external view returns (string memory) {
        return _toEncryptedString(userBalance[user][asset]);
    }

    function getUserPositionTest(address user) external view returns (bool initialized, address currentDebtAsset) {
        UserPosition storage p = userPositions[user];
        return (p.initialized, p.currentDebtAsset);
    }
}
