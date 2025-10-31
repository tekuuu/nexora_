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

// Additional constants for Pool Configurator tests
export const COLLATERAL_FACTOR_75 = BigInt(7500); // 75% LTV
export const COLLATERAL_FACTOR_80 = BigInt(8000); // 80% LTV
export const COLLATERAL_FACTOR_50 = BigInt(5000); // 50% LTV
export const COLLATERAL_FACTOR_INVALID_HIGH = BigInt(10001); // > 10000 invalid
export const COLLATERAL_FACTOR_ZERO = BigInt(0);

export const SUPPLY_CAP_1M = BigInt(1_000_000);
export const SUPPLY_CAP_5M = BigInt(5_000_000);
export const BORROW_CAP_500K = BigInt(500_000);
export const BORROW_CAP_1M = BigInt(1_000_000);
export const CAP_ZERO = BigInt(0);

// Note: new constants are exported as named exports above. The file already
// exposes a default export for legacy imports; avoid duplicating default
// exports to keep TS module semantics correct.

// Phase 3 specific constants for pool initialization & protocol controls
export const TOKEN_DECIMALS_18 = BigInt(18);
export const TOKEN_DECIMALS_6 = BigInt(6);
export const TOKEN_INITIAL_MINT = BigInt(1_000_000);
export const TOKEN_SUPPLY_TOP_UP = BigInt(500_000);
export const RESERVE_SUPPLY_CAP_TEST = BigInt(2_500_000);
export const RESERVE_BORROW_CAP_TEST = BigInt(1_500_000);
export const GAS_LIMIT_LIBRARY_DEPLOY = BigInt(1_500_000);
export const GAS_LIMIT_POOL_DEPLOY = BigInt(3_500_000);
export const GAS_LIMIT_RESERVE_INIT = BigInt(2_500_000);
export const PROTOCOL_STATE_ACTIVE = BigInt(0);
export const PROTOCOL_STATE_PAUSED = BigInt(1);

// Phase 4: Supply & Withdraw testing constants
// Amounts (normalized to 6 decimals)
export const SUPPLY_AMOUNT_SMALL = 100n * 10n ** 6n; // 100 tokens
export const SUPPLY_AMOUNT_MEDIUM = 1000n * 10n ** 6n; // 1,000 tokens
export const SUPPLY_AMOUNT_LARGE = 10000n * 10n ** 6n; // 10,000 tokens
export const WITHDRAW_AMOUNT_PARTIAL = 50n * 10n ** 6n; // 50 tokens
export const WITHDRAW_AMOUNT_FULL = 100n * 10n ** 6n; // 100 tokens
export const WITHDRAW_AMOUNT_EXCEEDING = 200n * 10n ** 6n; // 200 tokens

// Initial mint amounts per user
export const USER_INITIAL_MINT_WETH = 100000n * 10n ** 6n; // 100,000
export const USER_INITIAL_MINT_USDC = 500000n * 10n ** 6n; // 500,000
export const USER_INITIAL_MINT_DAI = 500000n * 10n ** 6n; // 500,000

// Supply cap variants
export const SUPPLY_CAP_LOW = 5000n * 10n ** 6n;
export const SUPPLY_CAP_REACHED = 10000n * 10n ** 6n;
export const SUPPLY_CAP_UNLIMITED = 0n;

// Reserve state markers (approximate expectations)
export const RESERVE_TOTAL_SUPPLIED_ZERO = 0n;
export const RESERVE_LIQUIDITY_AFTER_SUPPLY = 100n * 10n ** 6n;
export const RESERVE_LIQUIDITY_AFTER_WITHDRAW = 50n * 10n ** 6n;

// Gas limits for FHE-heavy paths
export const GAS_LIMIT_SUPPLY = 5_000_000n;
export const GAS_LIMIT_WITHDRAW = 5_000_000n;
export const GAS_LIMIT_TOKEN_MINT = 3_000_000n;

// Test user indices for organizing scenarios
export const TEST_USER_1_INDEX = 0;
export const TEST_USER_2_INDEX = 1;
export const TEST_USER_3_INDEX = 2;
