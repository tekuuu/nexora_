// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title SafeMath64
 * @notice Safe math operations for uint64 to prevent overflow/underflow
 * @dev Inspired by OpenZeppelin SafeMath and Aave's math libraries
 * 
 * Usage:
 * - For plaintext uint64 operations (prices, factors, caps, etc.)
 * - Complements SafeFHEOperations (which is for encrypted euint64)
 * 
 * Why uint64?
 * - Matches euint64 encrypted type
 * - Future upgrade path to uint256/euint256
 * - Gas efficient for storage
 */
library SafeMath64 {
    
    /**
     * @notice Safely multiply two values and divide by precision
     * @dev Uses uint256 intermediate calculation to prevent overflow
     * @dev This is the PRIMARY function for fixed-point multiplication
     * 
     * Example: mulDiv(2000e12, 0.75e12, 1e12) = 1500e12
     * (price * collateralFactor / PRECISION)
     * 
     * @param a First operand (e.g., collateral price)
     * @param b Second operand (e.g., collateral factor)
     * @param denominator Divisor (e.g., PRECISION = 1e12)
     * @return result a * b / denominator (safely)
     */
    function mulDiv(uint64 a, uint64 b, uint64 denominator) internal pure returns (uint64) {
        require(denominator > 0, "SafeMath64: division by zero");
        
        // Use uint256 to prevent overflow during multiplication
        uint256 product = uint256(a) * uint256(b);
        uint256 result = product / uint256(denominator);
        
        // Ensure result fits in uint64
        require(result <= type(uint64).max, "SafeMath64: mulDiv overflow");
        
        return uint64(result);
    }
    
    /**
     * @notice Safely multiply two uint64 values
     * @dev Checks for overflow using uint256 intermediate
     * @param a First operand
     * @param b Second operand
     * @return result a * b (safely)
     */
    function mul(uint64 a, uint64 b) internal pure returns (uint64) {
        // Gas optimization: if a is 0, result is 0
        if (a == 0) {
            return 0;
        }
        
        uint256 c = uint256(a) * uint256(b);
        require(c <= type(uint64).max, "SafeMath64: multiplication overflow");
        
        return uint64(c);
    }
    
    /**
     * @notice Safely divide two uint64 values
     * @dev Prevents division by zero
     * @param a Numerator
     * @param b Denominator
     * @return result a / b (safely)
     */
    function div(uint64 a, uint64 b) internal pure returns (uint64) {
        require(b > 0, "SafeMath64: division by zero");
        return a / b;
    }
    
    /**
     * @notice Safely add two uint64 values
     * @dev Checks for overflow
     * @param a First operand
     * @param b Second operand
     * @return result a + b (safely)
     */
    function add(uint64 a, uint64 b) internal pure returns (uint64) {
        uint64 c = a + b;
        require(c >= a, "SafeMath64: addition overflow");
        return c;
    }
    
    /**
     * @notice Safely subtract two uint64 values
     * @dev Checks for underflow
     * @param a Minuend
     * @param b Subtrahend
     * @return result a - b (safely)
     */
    function sub(uint64 a, uint64 b) internal pure returns (uint64) {
        require(b <= a, "SafeMath64: subtraction underflow");
        return a - b;
    }
    
    /**
     * @notice Calculate percentage of a value
     * @dev Useful for calculating fees, factors, etc.
     * @param value Base value
     * @param percentage Percentage in precision units (e.g., 0.75e12 = 75%)
     * @param precision Precision divisor (e.g., 1e12)
     * @return result value * percentage / precision
     */
    function percentageOf(uint64 value, uint64 percentage, uint64 precision) internal pure returns (uint64) {
        return mulDiv(value, percentage, precision);
    }
    
    /**
     * @notice Get minimum of two values
     * @param a First value
     * @param b Second value
     * @return Minimum value
     */
    function min(uint64 a, uint64 b) internal pure returns (uint64) {
        return a < b ? a : b;
    }
    
    /**
     * @notice Get maximum of two values
     * @param a First value
     * @param b Second value
     * @return Maximum value
     */
    function max(uint64 a, uint64 b) internal pure returns (uint64) {
        return a > b ? a : b;
    }
}


