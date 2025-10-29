// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {euint64} from "@fhevm/solidity/lib/FHE.sol";
import {Types} from "../libraries/Types.sol";

interface IConfidentialLendingPoolView {
    function getUserSuppliedBalance(address user, address asset) external view returns (euint64);
    function getUserBorrowedBalance(address user, address asset) external view returns (euint64);
    function getUserPosition(address user) external view returns (Types.ConfidentialUserPosition memory);
    function getReserveData(address asset) external view returns (Types.ConfidentialReserve memory);
    function getReserveList() external view returns (address[] memory);
   /* function getMaxBorrowableAmount(address user, address asset) external returns (euint64);*/
}