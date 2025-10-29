// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library Constants {
    // ========== PRECISION STANDARDS ==========
    /**
     * @notice Standard precision for internal token amounts and prices (6 decimals).
     */
    uint64 internal constant VALUE_PRECISION_FACTOR = 1e6; // 6 decimals

    /**
     * @notice Standard precision for percentages like LTV, rates (4 decimals / Basis Points).
     * Represents 100%. 1 Basis Point (BP) = 0.01%.
     */
    uint64 internal constant PERCENT_PRECISION = 10000; // 4 decimals (Basis Points)

    // ========== DEFAULT RESERVE PARAMETERS ==========
    /**
     * @notice Default Collateral Factor (75.00%). In basis points.
     */
    uint64 internal constant DEFAULT_COLLATERAL_FACTOR = 7500; // 7500 BP = 75%

    // ========== RATE CONSTANTS (Example Values - Needs Proper Calculation Logic) ==========
    /**
     * @notice Default Liquidity Rate (3.00% APY). In basis points.
     */
    uint64 internal constant DEFAULT_LIQUIDITY_RATE = 300; // 300 BP = 3%

    /**
     * @notice Default Borrow Rate (5.00% APY). In basis points.
     */
    uint64 internal constant DEFAULT_BORROW_RATE = 500; // 500 BP = 5%

    // ========== INTEREST RATE MODEL DEFAULTS (In Basis Points) ==========
    uint64 internal constant DEFAULT_BASE_RATE = 200;       // 2.00%
    uint64 internal constant DEFAULT_MULTIPLIER = 1000;     // 10.00%
    uint64 internal constant DEFAULT_JUMP_MULTIPLIER = 30000; // 300.00% (Note: Often higher in practice)
    uint64 internal constant DEFAULT_KINK = 8000;       // 80.00% Utilization

    // ========== RATE SAFETY LIMITS (In Basis Points) ==========
    uint64 internal constant MAX_BORROW_RATE = 5000;     // 50.00% max APY
    uint64 internal constant MIN_BORROW_RATE = 100;      // 1.00% min APY
    uint64 internal constant MIN_LIQUIDITY_RATE = 50;       // 0.50% min APY

    // ========== INTEREST RATE MODEL SAFETY BOUNDS (In Basis Points) ==========
    uint64 internal constant MAX_BASE_RATE = 1000;       // 10.00% max
    uint64 internal constant MAX_MULTIPLIER = 5000;      // 50.00% max
    uint64 internal constant MAX_JUMP_MULTIPLIER = 50000; // 500.00% max (Adjust as needed)
    uint64 internal constant MIN_KINK = 5000;       // 50.00% min utilization
    uint64 internal constant MAX_KINK = 9000;       // 90.00% max utilization

    // ========== ADDITIONAL SAFETY CONSTANTS (In Basis Points) ==========
    /**
     * @notice Max percentage of borrow interest allocated to the reserve pool.
     */
    uint64 internal constant MAX_RESERVE_FACTOR = 3000;    // 30.00% max

    uint64 internal constant MIN_COLLATERAL_FACTOR = 1000;    // 10.00% min
    uint64 internal constant MAX_COLLATERAL_FACTOR = 9000;    // 90.00% max

    // ========== TIME CONSTANTS (Unchanged) ==========
    uint64 internal constant MIN_TIME_ELAPSED = 1 hours;
    uint64 internal constant MAX_ACCRUAL_PERIOD = 90 days;
    uint64 internal constant MIN_COMPOUNDING_PERIOD = 1 days;
    uint64 internal constant SECONDS_PER_YEAR = 365 days;

    // ========== FHE LIMITS (Unchanged) ==========
    uint64 internal constant MAX_EUINT64 = type(uint64).max;

    // ========== ROLE IDENTIFIERS (Unchanged) ==========
    bytes32 internal constant POOL_ADMIN = keccak256("POOL_ADMIN");
    bytes32 internal constant EMERGENCY_ADMIN = keccak256("EMERGENCY_ADMIN");
    bytes32 internal constant RISK_ADMIN = keccak256("RISK_ADMIN");
}