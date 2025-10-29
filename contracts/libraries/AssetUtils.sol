// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, euint128} from "@fhevm/solidity/lib/FHE.sol";

library AssetUtils {

    /**
     * @notice Converts a raw token amount into its 12-decimal normalized USD value.
     * @param amount The token balance as an euint64 (respecting OZ's standard).
     * @param price The token's price, normalized to 12 decimals.
     * @param decimals The *actual* decimals of the token (e.g., 6 for cUSDC, 18 for cWETH).
     * @return The 12-decimal normalized USD value as an euint128.
     */
    function getUsdValue(
        euint64 amount,
        uint128 price,
        uint8 decimals
    ) internal returns (euint128) {
        if (decimals > 38 || price == 0) {
            return FHE.asEuint128(0);
        }

        euint128 amount128 = FHE.asEuint128(amount);
        euint128 price128 = FHE.asEuint128(price);
        uint128 denominator = uint128(10)**uint128(decimals);
        
        if (denominator == 0) {
            return FHE.asEuint128(0); 
        }

        euint128 usdValue = FHE.mul(amount128, price128);
        usdValue = FHE.div(usdValue, denominator); // div by plaintext

        return usdValue;
    }
}