// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library Errors {
    // Reserve errors
    string public constant RESERVE_NOT_ACTIVE = "1";
    string public constant BORROWING_NOT_ENABLED = "2";
    string public constant RESERVE_ALREADY_INITIALIZED = "3";
    
    // Balance errors
    string public constant INSUFFICIENT_BALANCE = "4";
    string public constant INSUFFICIENT_COLLATERAL = "5";
    string public constant DEBT_AMOUNT_EXCEEDS_BALANCE = "6";
    
    // Access control errors
    string public constant ONLY_POOL_ADMIN = "10";
    string public constant ONLY_PRICE_FEED = "11";
    string public constant UNAUTHORIZED_ACCESS = "12";
    
    // Oracle errors
    string public constant PRICE_NOT_SET = "13";
    string public constant INVALID_PRICE = "14";
    string public constant ORACLE_NOT_SET = "15";
    
    // Input validation errors
    string public constant INVALID_INPUT_PROOF = "16";
    string public constant ZERO_ADDRESS = "17";
    string public constant INVALID_AMOUNT = "18";
    
    // Protocol state errors
    string public constant PROTOCOL_PAUSED = "19";
    string public constant SUPPLY_CAP_EXCEEDED = "20";
    string public constant BORROW_CAP_EXCEEDED = "21";
    string public constant LIQUIDATION_AMOUNT_TOO_HIGH = "22";
    
    // Initialization errors
    string public constant ALREADY_INITIALIZED = "23";
    string public constant NOT_INITIALIZED = "24";
    string public constant INVALID_TIMESTAMP = '25';
    string public constant INVALID_RESERVE_FACTOR = '26';
    string public constant INVALID_BASE_RATE = '27';
    string public constant INVALID_MULTIPLIER = '28';
    string public constant INVALID_JUMP_MULTIPLIER = '29';
    string public constant INVALID_KINK = '30';
    string public constant INVALID_LIQUIDATION_THRESHOLD = '31';
    string public constant INVALID_COLLATERAL_FACTOR = '32';
    string public constant INVALID_LIQUIDATION_BONUS = '33';
    string public constant INVALID_CLOSE_FACTOR = '34';
    string public constant INVALID_INTEREST_RATE_STRATEGY = '35';
    string public constant INVALID_RESERVE_CONFIGURATION = '36';
    string public constant INVALID_ASSET = '37';
    string public constant ASSET_ALREADY_INITIALIZED = '38';
    string public constant ASSET_NOT_INITIALIZED = '39';
    string public constant INVALID_USER_POSITION = '40';
    string public constant USER_POSITION_NOT_INITIALIZED = '41';
    string public constant USER_POSITION_ALREADY_INITIALIZED = '42';
    string internal constant NO_COLLATERAL_ENABLED = "NO_COLLATERAL_ENABLED";
}