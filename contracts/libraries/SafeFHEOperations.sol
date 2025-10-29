// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, ebool} from "@fhevm/solidity/lib/FHE.sol";
import "../config/Constants.sol";

/**
 * @title SafeFHEOperations
 * @notice Gas-efficient FHE operations using FHE.select pattern (inspired by working example)
 * @dev Avoids expensive FHE.decrypt() calls while maintaining security
 */
library SafeFHEOperations {
    using FHE for euint64;
    using FHE for ebool;

    /**
     * @notice Validates and caps an encrypted amount against allowed bounds
     * @dev Ensures amount is non-negative and within maximum limit. Returns original amount if valid, otherwise returns zero.
     * @param amount Encrypted amount to validate
     * @param maxAllowed Maximum allowed encrypted amount
     * @return safeAmount Original amount if 0 <= amount <= maxAllowed, otherwise zero
     */
    function validateAndCap(euint64 amount, euint64 maxAllowed) internal returns (euint64) {
        ebool isNonNegative = amount.ge(FHE.asEuint64(0));
        ebool isWithinLimit = amount.le(maxAllowed);
        ebool isValid = isNonNegative.and(isWithinLimit);
        
        return FHE.select(isValid, amount, FHE.asEuint64(0));
    }

    /**
     * @notice Safely subtract with underflow protection
     * @dev Returns zero if underflow would occur
     * @param a Minuend
     * @param b Subtrahend
     * @return result Safe subtraction result
     */
    function safeSub(euint64 a, euint64 b) internal returns (euint64) {
        ebool willUnderflow = FHE.gt(b, a);
        return FHE.select(willUnderflow, FHE.asEuint64(0), FHE.sub(a, b));
    }

    /**
     * @notice Safely add with overflow protection
     * @dev Returns zero if overflow would occur
     * @param a First operand
     * @param b Second operand
     * @return result Safe addition result
     */
    function safeAdd(euint64 a, euint64 b) internal returns (euint64) {
        euint64 temp = FHE.add(a, b);
        ebool hasOverflow = FHE.lt(temp, a);
        return FHE.select(hasOverflow, FHE.asEuint64(0), temp);
    }

    /**
     * @notice Check if amount is sufficient for operation
     * @dev Returns 1 if sufficient, 0 if not (for use in calculations)
     * @param amount Requested amount
     * @param balance Available balance
     * @return flag 1 if sufficient, 0 if not
     */
    function isSufficient(euint64 amount, euint64 balance) internal returns (euint64) {
        ebool sufficient = FHE.le(amount, balance);
        return FHE.select(sufficient, FHE.asEuint64(1), FHE.asEuint64(0));
    }
    
    /**
     * @notice Ensure value is initialized
     * @dev Returns 0 if not initialized, otherwise returns original value
     * @param value The value to check
     * @return initializedValue The initialized value
     */
    function ensureInitialized(euint64 value) internal returns (euint64) {
        bool isInit = FHE.isInitialized(value);
        if (isInit) {
            return value;
        }
        return FHE.asEuint64(0);
    }
}
