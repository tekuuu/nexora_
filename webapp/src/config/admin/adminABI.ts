/**
 * Complete Admin ABIs
 * All functions from ACLManager and PoolConfigurator
 */

// Complete ACL Manager ABI
export const ACL_MANAGER_ABI = [
  // Role constants
  {
    "inputs": [],
    "name": "POOL_ADMIN",
    "outputs": [{ "internalType": "bytes32", "name": "", "type": "bytes32" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "EMERGENCY_ADMIN",
    "outputs": [{ "internalType": "bytes32", "name": "", "type": "bytes32" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "RISK_ADMIN",
    "outputs": [{ "internalType": "bytes32", "name": "", "type": "bytes32" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "DEFAULT_ADMIN_ROLE",
    "outputs": [{ "internalType": "bytes32", "name": "", "type": "bytes32" }],
    "stateMutability": "view",
    "type": "function"
  },
  // Role checks
  {
    "inputs": [
      { "internalType": "bytes32", "name": "role", "type": "bytes32" },
      { "internalType": "address", "name": "account", "type": "address" }
    ],
    "name": "hasRole",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "account", "type": "address" }],
    "name": "isPoolAdmin",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "account", "type": "address" }],
    "name": "isEmergencyAdmin",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "account", "type": "address" }],
    "name": "isRiskAdmin",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },
  // Role management
  {
    "inputs": [
      { "internalType": "bytes32", "name": "role", "type": "bytes32" },
      { "internalType": "address", "name": "account", "type": "address" }
    ],
    "name": "grantRole",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "bytes32", "name": "role", "type": "bytes32" },
      { "internalType": "address", "name": "account", "type": "address" }
    ],
    "name": "revokeRole",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
] as const;

// Complete Pool Configurator ABI
export const CONFIGURATOR_ABI = [
  // Link status
  {
    "inputs": [],
    "name": "lendingPool",
    "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "stateMutability": "view",
    "type": "function"
  },
  // View functions
  {
    "inputs": [{ "internalType": "address", "name": "asset", "type": "address" }],
    "name": "getReserveConfig",
    "outputs": [{
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
    }],
    "stateMutability": "view",
    "type": "function"
  },
  // Initialize reserve
  {
    "inputs": [
      { "internalType": "address", "name": "asset", "type": "address" },
      { "internalType": "bool", "name": "borrowingEnabled", "type": "bool" },
      { "internalType": "bool", "name": "isCollateral", "type": "bool" },
      { "internalType": "uint64", "name": "collateralFactor", "type": "uint64" }
    ],
    "name": "initReserve",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // Reserve configuration functions
  {
    "inputs": [
      { "internalType": "address", "name": "asset", "type": "address" },
      { "internalType": "bool", "name": "active", "type": "bool" }
    ],
    "name": "setReserveActive",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "asset", "type": "address" },
      { "internalType": "bool", "name": "enabled", "type": "bool" }
    ],
    "name": "setReserveBorrowing",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "asset", "type": "address" },
      { "internalType": "bool", "name": "enabled", "type": "bool" }
    ],
    "name": "setReserveCollateral",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "asset", "type": "address" },
      { "internalType": "uint64", "name": "factor", "type": "uint64" }
    ],
    "name": "setCollateralFactor",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "asset", "type": "address" },
      { "internalType": "uint64", "name": "cap", "type": "uint64" }
    ],
    "name": "setSupplyCap",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "asset", "type": "address" },
      { "internalType": "uint64", "name": "cap", "type": "uint64" }
    ],
    "name": "setBorrowCap",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // Emergency functions
  {
    "inputs": [{ "internalType": "address", "name": "asset", "type": "address" }],
    "name": "pauseReserve",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "asset", "type": "address" }],
    "name": "unpauseReserve",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // Set lending pool
  {
    "inputs": [{ "internalType": "address", "name": "_lendingPool", "type": "address" }],
    "name": "setLendingPool",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
] as const;

// Oracle ABI
export const ORACLE_ABI = [
  {
    "inputs": [{ "internalType": "address", "name": "asset", "type": "address" }],
    "name": "getPrice",
    "outputs": [{ "internalType": "uint64", "name": "", "type": "uint64" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "asset", "type": "address" },
      { "internalType": "uint64", "name": "price", "type": "uint64" }
    ],
    "name": "setPrice",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address[]", "name": "assets", "type": "address[]" },
      { "internalType": "uint64[]", "name": "prices", "type": "uint64[]" }
    ],
    "name": "setPrices",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
] as const;

