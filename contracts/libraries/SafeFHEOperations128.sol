// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint128, ebool} from "@fhevm/solidity/lib/FHE.sol";

library SafeFHEOperations128 {
    using FHE for euint128;
    using FHE for ebool;

    function safeSub(euint128 a, euint128 b) internal returns (euint128) {
        ebool willUnderflow = FHE.gt(b, a);
        return FHE.select(willUnderflow, FHE.asEuint128(0), FHE.sub(a, b));
    }

    function safeAdd(euint128 a, euint128 b) internal returns (euint128) {
        euint128 temp = FHE.add(a, b);
        ebool hasOverflow = FHE.lt(temp, a);
        return FHE.select(hasOverflow, FHE.asEuint128(0), temp);
    }

    function safeMul(euint128 a, uint128 b) internal returns (euint128) {
        if (b == 0) {
            return FHE.asEuint128(0);
        }
        euint128 temp = FHE.mul(a, b);
        ebool hasOverflow = FHE.ne(FHE.div(temp, b), a);
        return FHE.select(hasOverflow, FHE.asEuint128(0), temp);
    }

    function safeDiv(euint128 a, uint128 b) internal returns (euint128) {
        if (b == 0) {
            return FHE.asEuint128(0);
        }
        return FHE.div(a, b);
    }
}