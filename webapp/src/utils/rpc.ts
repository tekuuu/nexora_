/**
 * RPC Configuration Utility
 * Uses centralized NETWORK_CONFIG for RPC URL.
 */

import { NETWORK_CONFIG } from '../config/contracts';

export const SEPOLIA_RPC_URLS = [
  NETWORK_CONFIG.rpcUrl,
];

/**
 * Get the Sepolia RPC URL (from env)
 */
export const getSepoliaRpcUrl = (): string => {
  const url = SEPOLIA_RPC_URLS.find((u) => u && u.trim() !== '');
  if (!url) {
    throw new Error('No valid RPC URL found. Please set NEXT_PUBLIC_RPC_URL in your environment.');
  }
  return url;
};

/**
 * Get multiple RPC URLs for fallback scenarios
 */
export const getSepoliaRpcUrls = (): string[] => {
  return SEPOLIA_RPC_URLS.filter((url): url is string => url !== undefined && url.trim() !== '');
};
