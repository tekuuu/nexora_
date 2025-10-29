/**
 * Token Metadata Registry
 * Contains display information for all confidential tokens
 * 
 * When adding a new token:
 * 1. Deploy the confidential token contract
 * 2. Add entry here with metadata
 * 3. Add icon to /public/assets/icons/
 * 4. Use Admin UI to initialize reserve
 * 5. Token will appear in all lists automatically!
 */

import { CONTRACTS } from './contracts';

export interface TokenMetadata {
  symbol: string;
  name: string;
  decimals: number;
  icon: string; // Path relative to /public
  color: string; // Brand color for UI
  underlying: string; // ERC20 address
  description?: string;
}

export const TOKEN_METADATA: Record<string, TokenMetadata> = {
  // Confidential WETH
  [CONTRACTS.CONFIDENTIAL_WETH]: {
    symbol: 'cWETH',
    name: 'Confidential Wrapped Ether',
    decimals: 6,
    icon: '/assets/icons/weth.svg',
    color: '#627EEA',
    underlying: CONTRACTS.WETH,
    description: 'Privacy-preserving wrapped Ether with encrypted balances',
  },

  // Confidential USDC
  [CONTRACTS.CONFIDENTIAL_USDC]: {
    symbol: 'cUSDC',
    name: 'Confidential USD Coin',
    decimals: 6,
    icon: '/assets/icons/usdc.svg',
    color: '#2775CA',
    underlying: CONTRACTS.USDC,
    description: 'Privacy-preserving USDC stablecoin with encrypted balances',
  },

  // Confidential DAI
  [CONTRACTS.CONFIDENTIAL_DAI]: {
    symbol: 'cDAI',
    name: 'Confidential DAI',
    decimals: 6,
    icon: '/assets/icons/dai.svg',
    color: '#F5AC37',
    underlying: CONTRACTS.DAI,
    description: 'Privacy-preserving DAI stablecoin with encrypted balances',
  },

  // Add more tokens here as they are deployed:
  // [CONTRACTS.CONFIDENTIAL_BTC]: {
  //   symbol: 'cBTC',
  //   name: 'Confidential Wrapped Bitcoin',
  //   decimals: 8,
  //   icon: '/assets/icons/btc.svg',
  //   color: '#F7931A',
  //   underlying: CONTRACTS.WBTC,
  //   description: 'Privacy-preserving wrapped Bitcoin',
  // },
};

/**
 * Get metadata for a token address
 */
export function getTokenMetadata(address: string): TokenMetadata | undefined {
  return TOKEN_METADATA[address.toLowerCase()] || TOKEN_METADATA[address];
}

/**
 * Get all known token addresses
 */
export function getAllKnownTokens(): string[] {
  return Object.keys(TOKEN_METADATA);
}

/**
 * Check if a token is known/has metadata
 */
export function isKnownToken(address: string): boolean {
  return address in TOKEN_METADATA || address.toLowerCase() in TOKEN_METADATA;
}

