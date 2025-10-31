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

// Phase 5: Collateral Management testing constants
// Collateral toggle boolean flags
export const COLLATERAL_ENABLED = true;
export const COLLATERAL_DISABLED = false;

// Collateral state markers for mapping checks
export const USER_HAS_NO_COLLATERAL = false;
export const USER_HAS_COLLATERAL = true;

// Test scenario amounts (6 decimals)
export const COLLATERAL_SUPPLY_AMOUNT = 5000n * 10n ** 6n; // 5,000 tokens
export const COLLATERAL_WITHDRAW_SAFE = 1000n * 10n ** 6n; // 1,000 tokens
export const COLLATERAL_WITHDRAW_UNSAFE = 4500n * 10n ** 6n; // 4,500 tokens

// Error message identifiers (custom errors in ConfidentialLendingPool)
export const ERROR_NOT_DESIGNATED_COLLATERAL = "NotTheDesignatedCollateral";
export const ERROR_RESERVE_NOT_COLLATERAL = "ReserveNotCollateral";
export const ERROR_PROTOCOL_PAUSED = "ProtocolPaused";
export const ERROR_RESERVE_NOT_ACTIVE = "ReserveNotActive";

// Event name identifiers
export const EVENT_USER_COLLATERAL_CHANGED = "UserCollateralChanged";

// Phase 6: Borrow & Repay testing constants
// Borrow Test Amounts (6 decimals)
export const BORROW_AMOUNT_SMALL = 500n * 10n ** 6n; // 500 tokens
export const BORROW_AMOUNT_MEDIUM = 2000n * 10n ** 6n; // 2,000 tokens
export const BORROW_AMOUNT_LARGE = 5000n * 10n ** 6n; // 5,000 tokens
export const BORROW_AMOUNT_EXCEEDING = 10000n * 10n ** 6n; // 10,000 tokens

// Repay Test Amounts (6 decimals)
export const REPAY_AMOUNT_PARTIAL = 250n * 10n ** 6n; // 250 tokens
export const REPAY_AMOUNT_FULL = 500n * 10n ** 6n; // 500 tokens
export const REPAY_AMOUNT_OVERPAY = 1000n * 10n ** 6n; // 1,000 tokens
export const REPAY_AMOUNT_ZERO = 0n; // Zero repayment

// Collateral Setup Amounts for Borrowing Tests (6 decimals)
export const COLLATERAL_FOR_BORROW_SMALL = 1000n * 10n ** 6n; // 1,000 cWETH
export const COLLATERAL_FOR_BORROW_MEDIUM = 5000n * 10n ** 6n; // 5,000 cWETH
export const COLLATERAL_FOR_BORROW_LARGE = 10000n * 10n ** 6n; // 10,000 cWETH

// Borrowing Power Calculation Constants
export const COLLATERAL_FACTOR_FOR_TESTS = 7500n; // 75% LTV in bps
export const PERCENT_PRECISION_FOR_CALC = 10000n; // bps precision
export const WETH_PRICE_FOR_TESTS = 2000n * 10n ** 6n; // $2,000 per WETH
export const USDC_PRICE_FOR_TESTS = 1n * 10n ** 6n; // $1 per USDC

// Borrow Cap Test Values (6 decimals)
export const BORROW_CAP_LOW = 3000n * 10n ** 6n; // 3,000 tokens
export const BORROW_CAP_MEDIUM = 10000n * 10n ** 6n; // 10,000 tokens
export const BORROW_CAP_UNLIMITED = 0n; // zero means no cap

// Health Factor Test Values (6 decimals where applicable)
export const SAFE_WITHDRAWAL_WITH_DEBT = 500n * 10n ** 6n; // Safe withdrawal amount
export const UNSAFE_WITHDRAWAL_WITH_DEBT = 4000n * 10n ** 6n; // Unsafe withdrawal amount
export const HEALTH_FACTOR_THRESHOLD = 10000n; // 100% HF

// Debt Asset Tracking Constants
export const NO_DEBT_ASSET = "0x0000000000000000000000000000000000000000"; // Zero address
export const HAS_DEBT_ASSET = true;
export const NO_DEBT = false;

// Repay Flag Constants
export const IS_REPAYING_ALL_TRUE = true;
export const IS_REPAYING_ALL_FALSE = false;

// Gas Limits for Borrow/Repay Operations
export const GAS_LIMIT_BORROW = 6_000_000n;
export const GAS_LIMIT_REPAY = 5_000_000n;
export const GAS_LIMIT_WITHDRAW_WITH_DEBT = 6_000_000n;

// Error Message Constants for Phase 6
export const ERROR_NO_COLLATERAL_ENABLED = "NoCollateralEnabled";
export const ERROR_MULTIPLE_DEBTS_NOT_ALLOWED = "MultipleDebtsNotAllowed";
export const ERROR_BORROWING_NOT_ENABLED = "BorrowingNotEnabled";
export const ERROR_INVALID_DEBT_REPAYMENT = "InvalidDebtRepayment";
export const ERROR_ORACLE_PRICE_ZERO = "OraclePriceZero";
export const ERROR_INSUFFICIENT_LIQUIDITY = "InsufficientLiquidity";

// Event Name Constants for Phase 6
export const EVENT_BORROW = "Borrow";
export const EVENT_REPAY = "Repay";

// Multi-User Test Identifiers
export const BORROWER_1_INDEX = 0;
export const BORROWER_2_INDEX = 1;
export const BORROWER_3_INDEX = 2;

// ==============================================
// Phase 7: Sepolia Integration Testing Constants
// ==============================================

// Network Configuration Constants
/**
 * Sepolia network chain ID for network detection
 */
export const SEPOLIA_CHAIN_ID = 11155111n;
/**
 * Hardhat local network chain ID for mocked mode
 */
export const HARDHAT_CHAIN_ID = 31337n;
/**
 * Average Sepolia block time in milliseconds (12 seconds)
 */
export const SEPOLIA_BLOCK_TIME = 12_000; // ms
/**
 * Default confirmations to wait for on Sepolia
 */
export const SEPOLIA_CONFIRMATION_BLOCKS = 2;

// Timeout Constants for Sepolia Operations (milliseconds)
export const TIMEOUT_SUPPLY_SEPOLIA = 180_000; // 3 minutes
export const TIMEOUT_WITHDRAW_SEPOLIA = 180_000; // 3 minutes
export const TIMEOUT_BORROW_SEPOLIA = 240_000; // 4 minutes
export const TIMEOUT_REPAY_SEPOLIA = 180_000; // 3 minutes
export const TIMEOUT_COLLATERAL_TOGGLE_SEPOLIA = 120_000; // 2 minutes
export const TIMEOUT_HEALTH_CHECK_SEPOLIA = 240_000; // 4 minutes
export const TIMEOUT_DECRYPTION_CALLBACK = 60_000; // 1 minute
export const TIMEOUT_FULL_LIFECYCLE = 600_000; // 10 minutes

// Integration Test Amounts (6 decimals)
export const INTEGRATION_COLLATERAL_AMOUNT = 10_000n * 10n ** 6n; // 10,000 units
export const INTEGRATION_BORROW_AMOUNT = 5_000n * 10n ** 6n; // 5,000 units
export const INTEGRATION_SUPPLY_AMOUNT = 50_000n * 10n ** 6n; // 50,000 units
export const INTEGRATION_REPAY_AMOUNT = 2_500n * 10n ** 6n; // 2,500 units

// Multi-User Test Configuration
export const NUM_CONCURRENT_USERS = 3;
export const NUM_STRESS_TEST_USERS = 5;
export const OPERATIONS_PER_USER = 3;

// Reserve Liquidity Test Values (6 decimals)
export const INITIAL_RESERVE_LIQUIDITY = 1_000_000n * 10n ** 6n; // 1,000,000
export const LOW_LIQUIDITY_THRESHOLD = 10_000n * 10n ** 6n; // 10,000
export const DEPLETED_LIQUIDITY_THRESHOLD = 1_000n * 10n ** 6n; // 1,000

// Gas Cost Expectations (upper bounds)
export const EXPECTED_GAS_SUPPLY_MAX = 500_000n;
export const EXPECTED_GAS_WITHDRAW_MAX = 500_000n;
export const EXPECTED_GAS_BORROW_MAX = 800_000n;
export const EXPECTED_GAS_REPAY_MAX = 500_000n;
export const EXPECTED_GAS_COLLATERAL_TOGGLE_MAX = 200_000n;

// Decryption and Oracle Constants
export const DECRYPTION_RETRY_ATTEMPTS = 3;
export const DECRYPTION_RETRY_DELAY = 10_000; // 10s
export const ORACLE_CALLBACK_POLL_INTERVAL = 5_000; // 5s
export const ORACLE_CALLBACK_MAX_POLLS = 12; // 60s total

// Health Factor Test Scenarios
export const SAFE_HEALTH_FACTOR_MARGIN = 1_500n * 10n ** 6n; // margin in 6d precision
export const UNSAFE_HEALTH_FACTOR_MARGIN = 500n * 10n ** 6n; // margin in 6d precision
export const CRITICAL_HEALTH_FACTOR_THRESHOLD = 10_000n; // 100%

// Protocol Invariant Validation Constants
export const INVARIANT_CHECK_TOLERANCE = 100n;
export const RESERVE_TOTAL_TOLERANCE = 1_000n;

// Test Scenario Identifiers
export const SCENARIO_COMPLETE_LIFECYCLE = "complete_lifecycle";
export const SCENARIO_MULTI_USER = "multi_user";
export const SCENARIO_STRESS_TEST = "stress_test";
export const SCENARIO_LIQUIDATION = "liquidation";
export const SCENARIO_CROSS_ASSET = "cross_asset";

// Error Message Constants for Integration Tests
export const ERROR_DECRYPTION_TIMEOUT = "Decryption timeout exceeded";
export const ERROR_TRANSACTION_TIMEOUT = "Transaction confirmation timeout";
export const ERROR_INSUFFICIENT_SEPOLIA_ETH = "Insufficient Sepolia ETH for gas";
export const ERROR_NETWORK_NOT_SEPOLIA = "Tests must run on Sepolia network";

// Logging and Reporting Constants
export const LOG_LEVEL_VERBOSE = "verbose";
export const LOG_LEVEL_NORMAL = "normal";
export const LOG_LEVEL_QUIET = "quiet";
export const REPORT_GAS_COSTS: boolean = true;
export const REPORT_TIMING: boolean = true;
