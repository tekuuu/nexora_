// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

library Constants {
    // ========== PRECISION STANDARDS ==========

    uint64 internal constant VALUE_PRECISION_FACTOR = 1e6; // 6 decimals
    uint64 internal constant PERCENT_PRECISION = 10000; // 4 decimals (Basis Points)


    uint64 internal constant DEFAULT_COLLATERAL_FACTOR = 7500; 
    uint64 internal constant DEFAULT_LIQUIDITY_RATE = 300; 
    uint64 internal constant DEFAULT_BORROW_RATE = 500; 

    uint64 internal constant DEFAULT_BASE_RATE = 200;
    uint64 internal constant DEFAULT_MULTIPLIER = 1000;
    uint64 internal constant DEFAULT_JUMP_MULTIPLIER = 30000; 
    uint64 internal constant DEFAULT_KINK = 8000;

    // ========== RATE SAFETY LIMITS (In Basis Points) ==========
    uint64 internal constant MAX_BORROW_RATE = 5000;     
    uint64 internal constant MIN_BORROW_RATE = 100;     
    uint64 internal constant MIN_LIQUIDITY_RATE = 50;       

    // ========== INTEREST RATE MODEL SAFETY BOUNDS (In Basis Points) ==========
    uint64 internal constant MAX_BASE_RATE = 1000;       
    uint64 internal constant MAX_MULTIPLIER = 5000;     
    uint64 internal constant MAX_JUMP_MULTIPLIER = 50000;
    uint64 internal constant MIN_KINK = 5000;      
    uint64 internal constant MAX_KINK = 9000;  

    // ========== ADDITIONAL SAFETY CONSTANTS (In Basis Points) ==========
    uint64 internal constant MAX_RESERVE_FACTOR = 3000;  

    uint64 internal constant MIN_COLLATERAL_FACTOR = 1000; 
    uint64 internal constant MAX_COLLATERAL_FACTOR = 9000; 

    // ========== TIME CONSTANTS ==========
    uint64 internal constant MIN_TIME_ELAPSED = 1 hours;
    uint64 internal constant MAX_ACCRUAL_PERIOD = 90 days;
    uint64 internal constant MIN_COMPOUNDING_PERIOD = 1 days;
    uint64 internal constant SECONDS_PER_YEAR = 365 days;

    uint64 internal constant MAX_EUINT64 = type(uint64).max;

    // ========== ROLE IDENTIFIERS ==========
    bytes32 internal constant POOL_ADMIN = keccak256("POOL_ADMIN");
    bytes32 internal constant EMERGENCY_ADMIN = keccak256("EMERGENCY_ADMIN");
    bytes32 internal constant RISK_ADMIN = keccak256("RISK_ADMIN");
}