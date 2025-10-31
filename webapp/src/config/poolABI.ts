/**
 * ConfidentialLendingPool ABI
 * 
 * Main entry point for all lending operations:
 * - supply() - Deposit collateral
 * - withdraw() - Remove collateral
 * - borrow() - Take loans
 * - repay() - Pay back loans
 */

export const POOL_ABI = [
  // ========== ADMIN CONFIG ==========
  {
    "inputs": [
      { "internalType": "address", "name": "_configurator", "type": "address" }
    ],
    "name": "setConfigurator",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "_priceOracle", "type": "address" }
    ],
    "name": "setPriceOracle",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "configurator",
    "outputs": [ { "internalType": "address", "name": "", "type": "address" } ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "priceOracle",
    "outputs": [ { "internalType": "address", "name": "", "type": "address" } ],
    "stateMutability": "view",
    "type": "function"
  },
  // ========== EMERGENCY ==========
  {
    "inputs": [],
    "name": "paused",
    "outputs": [ { "internalType": "bool", "name": "", "type": "bool" } ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "pause",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "unpause",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // ========== USER OPERATIONS ==========
  {
    "inputs": [
      { "internalType": "address", "name": "asset", "type": "address" },
      { "internalType": "externalEuint64", "name": "amount", "type": "bytes32" },
      { "internalType": "bytes", "name": "inputProof", "type": "bytes" }
    ],
    "name": "supply",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "asset", "type": "address" },
      { "internalType": "externalEuint64", "name": "amount", "type": "bytes32" },
      { "internalType": "bytes", "name": "inputProof", "type": "bytes" }
    ],
    "name": "withdraw",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "asset", "type": "address" },
      { "internalType": "externalEuint64", "name": "amount", "type": "bytes32" },
      { "internalType": "bytes", "name": "inputProof", "type": "bytes" }
    ],
    "name": "borrow",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "asset", "type": "address" },
      { "internalType": "externalEuint64", "name": "amount", "type": "bytes32" },
      { "internalType": "bytes", "name": "inputProof", "type": "bytes" },
      { "internalType": "bool", "name": "isRepayingAll", "type": "bool" }
    ],
    "name": "repay",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "asset", "type": "address" },
      { "internalType": "bool", "name": "useAsCollateral", "type": "bool" }
    ],
    "name": "setUserUseReserveAsCollateral",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  
  // ========== VIEW FUNCTIONS ==========
  {
    "inputs": [
      { "internalType": "address", "name": "", "type": "address" },
      { "internalType": "address", "name": "", "type": "address" }
    ],
    "name": "userCollateralEnabled",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "user", "type": "address" },
      { "internalType": "address", "name": "asset", "type": "address" }
    ],
    "name": "getUserSuppliedBalance",
    "outputs": [
      { "internalType": "euint64", "name": "", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "user", "type": "address" },
      { "internalType": "address", "name": "asset", "type": "address" }
    ],
    "name": "getUserBorrowedBalance",
    "outputs": [
      { "internalType": "euint64", "name": "", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "asset", "type": "address" }
    ],
    "name": "getReserveData",
    "outputs": [
      {
        "components": [
          { "internalType": "address", "name": "underlyingAsset", "type": "address" },
          { "internalType": "euint64", "name": "totalSupplied", "type": "uint256" },
          { "internalType": "euint64", "name": "totalBorrowed", "type": "uint256" },
          { "internalType": "euint64", "name": "availableLiquidity", "type": "uint256" },
          { "internalType": "uint64", "name": "lastUpdateTimestamp", "type": "uint64" },
          { "internalType": "bool", "name": "active", "type": "bool" },
          { "internalType": "bool", "name": "borrowingEnabled", "type": "bool" },
          { "internalType": "bool", "name": "isCollateral", "type": "bool" },
          { "internalType": "bool", "name": "isPaused", "type": "bool" },
          { "internalType": "uint64", "name": "collateralFactor", "type": "uint64" },
          { "internalType": "uint64", "name": "supplyCap", "type": "uint64" },
          { "internalType": "uint64", "name": "borrowCap", "type": "uint64" }
        ],
        "internalType": "struct Types.ConfidentialReserve",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  
  // ========== EVENTS ==========
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "reserve", "type": "address" },
      { "indexed": true, "internalType": "address", "name": "user", "type": "address" }
    ],
    "name": "Supply",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "reserve", "type": "address" },
      { "indexed": true, "internalType": "address", "name": "user", "type": "address" }
    ],
    "name": "Withdraw",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "reserve", "type": "address" },
      { "indexed": true, "internalType": "address", "name": "user", "type": "address" }
    ],
    "name": "Borrow",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "reserve", "type": "address" },
      { "indexed": true, "internalType": "address", "name": "user", "type": "address" }
    ],
    "name": "Repay",
    "type": "event"
  }
] as const;

