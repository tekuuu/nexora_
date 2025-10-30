// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint64, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {SafeFHEOperations} from "./SafeFHEOperations.sol";
import "../config/Constants.sol"; 

library AssetUtils64 {
    using FHE for euint64;
    using SafeFHEOperations for euint64;

    /**
     * @notice Converts a 6-decimal normalized token amount into its 6-decimal USD value.
     * @param amountE6 The token balance normalized to 6 decimals.
     * @param priceE6 The token's price, normalized to 6 decimals.
     * @return The 6-decimal USD value as an euint64.
     * @dev WARNING: Intermediate multiplication might overflow euint64!
     * Calculates: (amount_e6 * price_e6) / 10^6
     */
    function getUsdValue64(euint64 amountE6,uint64 priceE6) internal returns (euint64) {
        if (priceE6 == 0) {
            return FHE.asEuint64(0);
        }

        uint64 precisionFactor = Constants.VALUE_PRECISION_FACTOR;
        euint64 usdValue = FHE.mul(amountE6, priceE6);
        usdValue = FHE.div(usdValue, precisionFactor); 

        return usdValue; // Result is 6-decimal USD
    }
}