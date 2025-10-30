// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

interface IPriceOracle {
    function getPrice(address asset) external view returns (uint64);
    function getAssetPrice(address asset) external view returns (uint64);
    function setPrice(address asset, uint64 price) external;
    function updatePrice(address asset, uint64 price) external;

    event PriceUpdated(address indexed asset, uint64 price);
}