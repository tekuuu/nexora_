// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library Constants {
    // ========== PRECISION STANDARDS ==========
    uint64 internal constant PRECISION = 1e12;        // Standard precision for all calculations
    uint64 internal constant BASIS_POINTS = 10000;    // 100% in basis points (1 BP = 0.01%)

    // ========== DEFAULT RESERVE PARAMETERS ==========
    uint64 internal constant DEFAULT_COLLATERAL_FACTOR = 0.75e12;         // 75%
    
    // ========== RATE CONSTANTS (Future: Will be calculated) ==========
    uint64 internal constant DEFAULT_LIQUIDITY_RATE = 0.03e12;            // 3% APY
    uint64 internal constant DEFAULT_BORROW_RATE = 0.05e12;               // 5% APY

    // ========== INTEREST RATE MODEL DEFAULTS ==========
    // All in 1e12 format for uint64 compatibility
    uint64 internal constant DEFAULT_BASE_RATE = 0.02e12;                 // 2%
    uint64 internal constant DEFAULT_MULTIPLIER = 0.1e12;                 // 10%
    uint64 internal constant DEFAULT_JUMP_MULTIPLIER = 3e12;              // 300%
    uint64 internal constant DEFAULT_KINK = 0.8e12;                       // 80%

    // ========== RATE SAFETY LIMITS ==========
    uint64 internal constant MAX_BORROW_RATE = 0.5e12;                    // 50% max
    uint64 internal constant MIN_BORROW_RATE = 0.01e12;                   // 1% min
    uint64 internal constant MIN_LIQUIDITY_RATE = 0.005e12;               // 0.5% min
    
    // ========== INTEREST RATE MODEL SAFETY BOUNDS ==========
    uint64 internal constant MAX_BASE_RATE = 0.1e12;                      // 10% max
    uint64 internal constant MAX_MULTIPLIER = 0.5e12;                     // 50% max
    uint64 internal constant MAX_JUMP_MULTIPLIER = 2e12;                  // 200% max
    uint64 internal constant MIN_KINK = 0.5e12;                           // 50% min
    uint64 internal constant MAX_KINK = 0.9e12;                           // 90% max

    // ========== ADDITIONAL SAFETY CONSTANTS ==========
    uint64 internal constant MAX_RESERVE_FACTOR = 0.3e12;                 // 30% max
    uint64 internal constant MIN_COLLATERAL_FACTOR = 0.1e12;              // 10% min
    uint64 internal constant MAX_COLLATERAL_FACTOR = 0.9e12;              // 90% max

    // ========== TIME CONSTANTS ==========
    uint64 internal constant MIN_TIME_ELAPSED = 1 hours;
    uint64 internal constant MAX_ACCRUAL_PERIOD = 90 days;
    uint64 internal constant MIN_COMPOUNDING_PERIOD = 1 days;
    uint64 internal constant SECONDS_PER_YEAR = 365 days;

    // ========== FHE LIMITS ==========
    uint64 internal constant MAX_EUINT64 = type(uint64).max;

    // ========== ROLE IDENTIFIERS ==========
    bytes32 internal constant POOL_ADMIN = keccak256("POOL_ADMIN");
    bytes32 internal constant EMERGENCY_ADMIN = keccak256("EMERGENCY_ADMIN");
    bytes32 internal constant RISK_ADMIN = keccak256("RISK_ADMIN");
}