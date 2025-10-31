/**
 * Validation helper for required environment variables that are strings.
 * Validates that a value exists but does NOT validate address format.
 */
function getRequiredEnvString(key: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${key}. Please check your .env.local file and ensure all required variables are set.`);
  }
  return value.trim();
}

/**
 * Validation helper for required environment variables that are Ethereum addresses.
 * Validates Ethereum address format in addition to existence check.
 */
function getRequiredEnvAddress(key: string, value: string | undefined): string {
  const address = getRequiredEnvString(key, value);  // ✅ Different name
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new Error(`Invalid Ethereum address for ${key}: ${address}. Addresses must start with '0x' followed by exactly 40 hexadecimal characters. Please check your .env.local file.`);
  }
  return address;
}

/**
 * Contract addresses loaded from environment variables.
 * All addresses are validated on startup - the app will not start if any are missing or invalid.
 */
export const CONTRACTS = {
  // Original ERC20 tokens on Sepolia
  WETH: getRequiredEnvAddress('NEXT_PUBLIC_WETH', process.env.NEXT_PUBLIC_WETH),
  USDC: getRequiredEnvAddress('NEXT_PUBLIC_USDC', process.env.NEXT_PUBLIC_USDC),
  DAI: getRequiredEnvAddress('NEXT_PUBLIC_DAI', process.env.NEXT_PUBLIC_DAI),

  // Confidential ERC7984 tokens
  CONFIDENTIAL_WETH: getRequiredEnvAddress('NEXT_PUBLIC_CONFIDENTIAL_WETH', process.env.NEXT_PUBLIC_CONFIDENTIAL_WETH),
  CONFIDENTIAL_USDC: getRequiredEnvAddress('NEXT_PUBLIC_CONFIDENTIAL_USDC', process.env.NEXT_PUBLIC_CONFIDENTIAL_USDC),
  CONFIDENTIAL_DAI: getRequiredEnvAddress('NEXT_PUBLIC_CONFIDENTIAL_DAI', process.env.NEXT_PUBLIC_CONFIDENTIAL_DAI),

  // Token Swapper
  TOKEN_SWAPPER: getRequiredEnvAddress('NEXT_PUBLIC_TOKEN_SWAPPER', process.env.NEXT_PUBLIC_TOKEN_SWAPPER),

  // Modular Lending Protocol
  LENDING_POOL: getRequiredEnvAddress('LENDING_POOL', process.env.LENDING_POOL || process.env.NEXT_PUBLIC_LENDING_POOL),
  POOL_CONFIGURATOR: getRequiredEnvAddress('POOL_CONFIGURATOR', process.env.POOL_CONFIGURATOR || process.env.NEXT_PUBLIC_POOL_CONFIGURATOR),
  PRICE_ORACLE: getRequiredEnvAddress('PRICE_ORACLE', process.env.PRICE_ORACLE || process.env.NEXT_PUBLIC_PRICE_ORACLE),
  ACL_MANAGER: getRequiredEnvAddress('ACL_MANAGER', process.env.ACL_MANAGER || process.env.NEXT_PUBLIC_ACL_MANAGER),

} as const;

/**
 * Token metadata mapping.
 */
export const TOKEN_INFO = {
  [CONTRACTS.WETH]: {
    name: 'Wrapped Ether',
    symbol: 'WETH',
    decimals: 18,
    confidentialSymbol: 'cWETH',
    confidentialName: 'Confidential Wrapped Ether'
  },
  [CONTRACTS.USDC]: {
    name: 'USD Coin',
    symbol: 'USDC',
    decimals: 6,
    confidentialSymbol: 'cUSDC',
    confidentialName: 'Confidential USD Coin'
  },
  [CONTRACTS.DAI]: {
    name: 'DAI Stablecoin',
    symbol: 'DAI',
    decimals: 18,
    confidentialSymbol: 'cDAI',
    confidentialName: 'Confidential DAI'
  }
} as const;

/**
 * Network configuration loaded from environment variables.
 */
export const NETWORK_CONFIG = {
  chainId: parseInt(getRequiredEnvString('NEXT_PUBLIC_CHAIN_ID', process.env.NEXT_PUBLIC_CHAIN_ID)),
  name: 'Sepolia',
  rpcUrl: getRequiredEnvString('NEXT_PUBLIC_RPC_URL', process.env.NEXT_PUBLIC_RPC_URL),
  explorerUrl: getRequiredEnvString('NEXT_PUBLIC_NETWORK_EXPLORER_URL', process.env.NEXT_PUBLIC_NETWORK_EXPLORER_URL),
} as const;

/**
 * Admin wallets loaded from environment variables.
 * Comma-separated list of Ethereum addresses, validated on startup.
 */
const adminWalletsStr = getRequiredEnvString('NEXT_PUBLIC_ADMIN_WALLETS', process.env.NEXT_PUBLIC_ADMIN_WALLETS);
export const ADMIN_WALLETS = adminWalletsStr.split(',').map(addr => addr.trim().toLowerCase()).map(addr => {
  if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) {
    throw new Error(`Invalid admin wallet address: ${addr}. Addresses must start with '0x' followed by exactly 40 hexadecimal characters. Please check your .env.local file.`);
  }
  return addr;
});
