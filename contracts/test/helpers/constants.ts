import { ethers } from "hardhat";

// Price constants (6 decimals precision)
export const DEFAULT_USDC_PRICE = BigInt(1_000_000); // 1e6
export const DEFAULT_USDT_PRICE = BigInt(1_000_000); // 1e6
export const DEFAULT_ETH_PRICE = BigInt(2_000_000_000); // 2000e6
export const DEFAULT_BTC_PRICE = BigInt(40_000_000_000); // 40000e6
export const DEFAULT_WETH_PRICE = BigInt(2_000_000_000); // 2000e6

// Role identifiers (keccak256 hashed strings)
export const POOL_ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("POOL_ADMIN"));
export const EMERGENCY_ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("EMERGENCY_ADMIN"));
export const RISK_ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("RISK_ADMIN"));
export const DEFAULT_ADMIN_ROLE = ethers.ZeroHash;

// Generic test values
export const ZERO_ADDRESS = ethers.ZeroAddress;
// Compute max uint64 correctly using BigInt arithmetic to avoid JS number precision issues
export const MAX_UINT64 = (BigInt(1) << BigInt(64)) - BigInt(1);
export const TEST_PRICE_1 = BigInt(1_000_000_000); // 1000e6
export const TEST_PRICE_2 = BigInt(2_000_000_000); // 2000e6
export const TEST_PRICE_3 = BigInt(3_000_000_000); // 3000e6

// Precision
export const VALUE_PRECISION_FACTOR = BigInt(1_000_000); // 1e6
export const PERCENT_PRECISION = 10_000; // basis points

export default {
  DEFAULT_USDC_PRICE,
  DEFAULT_USDT_PRICE,
  DEFAULT_ETH_PRICE,
  DEFAULT_BTC_PRICE,
  DEFAULT_WETH_PRICE,
  POOL_ADMIN_ROLE,
  EMERGENCY_ADMIN_ROLE,
  RISK_ADMIN_ROLE,
  DEFAULT_ADMIN_ROLE,
  ZERO_ADDRESS,
  MAX_UINT64,
  TEST_PRICE_1,
  TEST_PRICE_2,
  TEST_PRICE_3,
  VALUE_PRECISION_FACTOR,
  PERCENT_PRECISION,
};
