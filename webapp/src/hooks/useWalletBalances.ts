'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAccount } from 'wagmi';
import { createPublicClient, http, formatUnits } from 'viem';
import { sepolia } from 'wagmi/chains';
import { useAvailableReserves } from './useAvailableReserves';
import { getFHEInstance } from '../utils/fhe';
import { FhevmDecryptionSignature } from '../utils/FhevmDecryptionSignature';
import { getSepoliaRpcUrls } from '../utils/rpc';

// Simple cache for decrypted wallet balances (plaintext for development)
const balanceCache: Record<string, {
  value: string;           // "100.00 cUSDC"
  rawValue: bigint;        // 100000000n
  timestamp: number;
  isValid: boolean;
}> = {};

// Confidential Token ABI
const CONFIDENTIAL_TOKEN_ABI = [
  {
    "inputs": [{ "internalType": "address", "name": "account", "type": "address" }],
    "name": "balanceOf",
    "outputs": [{ "internalType": "euint64", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

export interface TokenBalance {
  address: string;
  symbol: string;
  decimals: number;
  formattedBalance: string;  // "100.00 cUSDC" or "••••••••"
  rawBalance: bigint | null;  // 100000000n or null
  hasBalance: boolean;
  isDecrypted: boolean;
  isLoading: boolean;
}

/**
 * Hook to manage wallet balances for all available tokens
 * Pattern matches existing useSuppliedBalance hook
 */
export function useWalletBalances(
  masterSignature: string | null,
  getMasterSignature: () => FhevmDecryptionSignature | null
) {
  const { address, isConnected } = useAccount();
  const { supplyAssets, isLoading: assetsLoading } = useAvailableReserves();
  
  const [balances, setBalances] = useState<Record<string, TokenBalance>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [decryptingTokens, setDecryptingTokens] = useState<Set<string>>(new Set());
  
  // Refs to prevent multiple simultaneous decryptions
  const decryptingRefs = useRef<Record<string, boolean>>({});

  /**
   * Invalidate cache for specific token
   */
  const invalidateToken = useCallback((tokenSymbol: string) => {
    console.log(`🗑️ Invalidating cache for ${tokenSymbol}`);
    const cacheKey = `${address}_${tokenSymbol}_wallet`;
    if (balanceCache[cacheKey]) {
      balanceCache[cacheKey].isValid = false;
    }
    
    // Update state to show encrypted balance
    setBalances(prev => ({
      ...prev,
      [tokenSymbol]: {
        ...prev[tokenSymbol],
        formattedBalance: '••••••••',
        isDecrypted: false,
        rawBalance: null
      }
    }));
  }, [address]);

  /**
   * Clear all cached balances
   */
  const clearCache = useCallback(() => {
    console.log('🗑️ Clearing all wallet balance cache');
    Object.keys(balanceCache).forEach(key => {
      if (key.includes(`${address}_`)) {
        delete balanceCache[key];
      }
    });
    setBalances({});
  }, [address]);

  /**
   * Fetch encrypted balances for all tokens
   */
  const fetchEncryptedBalances = useCallback(async () => {
    if (!address || supplyAssets.length === 0) {
      setBalances({});
      return;
    }

    setIsLoading(true);
    console.log('📡 Fetching encrypted balances for', supplyAssets.length, 'tokens...');

    try {
      const rpcUrls = getSepoliaRpcUrls();
      let publicClient;
      
      // Try RPC URLs until one works
      for (const rpcUrl of rpcUrls) {
        try {
          publicClient = createPublicClient({
            chain: sepolia,
            transport: http(rpcUrl)
          });
          await publicClient.getBlockNumber();
          break;
        } catch (err) {
          continue;
        }
      }

      if (!publicClient) {
        throw new Error('Failed to connect to RPC');
      }

      // Fetch all balances in parallel
      const balancePromises = supplyAssets.map(async (token) => {
        try {
          // Use getEncryptedBalance(address) instead of balanceOf(address)
          // Function signature: getEncryptedBalance(address) = 0x92a576e6
          const encryptedBalance = await publicClient.call({
            to: token.address as `0x${string}`,
            data: `0x92a576e6000000000000000000000000${address.slice(2)}` as `0x${string}` // getEncryptedBalance(address)
          });

          if (!encryptedBalance.data || encryptedBalance.data === '0x') {
            return { token, encryptedBalance: null };
          }

          return {
            token,
            encryptedBalance: encryptedBalance.data
          };
        } catch (error) {
          console.error(`Failed to fetch balance for ${token.symbol}:`, error);
          return null;
        }
      });

      const results = await Promise.all(balancePromises);

      // Update state with encrypted balances
      const newBalances: Record<string, TokenBalance> = {};
      
      results.forEach((result) => {
        if (!result) return;

        const { token, encryptedBalance } = result;
        const cacheKey = `${address}_${token.symbol}_wallet`;

        // Check if we have valid cached decrypted value
        const cached = balanceCache[cacheKey];
        if (cached && cached.isValid) {
          console.log(`✅ Using cached balance for ${token.symbol}:`, cached.value);
          newBalances[token.symbol] = {
            address: token.address,
            symbol: token.symbol,
            decimals: token.decimals,
            formattedBalance: cached.value,
            rawBalance: cached.rawValue,
            hasBalance: cached.rawValue > BigInt(0),
            isDecrypted: true,
            isLoading: false
          };
        } else {
          // No valid cache - show as encrypted
          const hasBalance = encryptedBalance && 
            encryptedBalance !== '0x' && 
            encryptedBalance !== '0x0000000000000000000000000000000000000000000000000000000000000000';
          
          newBalances[token.symbol] = {
            address: token.address,
            symbol: token.symbol,
            decimals: token.decimals,
            formattedBalance: '••••••••',
            rawBalance: null,
            hasBalance: Boolean(hasBalance),
            isDecrypted: false,
            isLoading: false
          };
        }
      });

      setBalances(newBalances);
      console.log('✅ Fetched encrypted balances for', Object.keys(newBalances).length, 'tokens');
    } catch (error) {
      console.error('Failed to fetch encrypted balances:', error);
    } finally {
      setIsLoading(false);
    }
  }, [address, supplyAssets]);

  /**
   * Decrypt balance for a specific token
   * Matches pattern from useSuppliedBalance
   */
  const decryptBalance = useCallback(async (tokenSymbol: string) => {
    if (!isConnected || !address || !masterSignature) {
      console.log('❌ Cannot decrypt: missing requirements');
      return;
    }

    // Prevent multiple simultaneous decryptions of same token
    if (decryptingRefs.current[tokenSymbol]) {
      console.log(`🔒 ${tokenSymbol} decryption already in progress, skipping...`);
      return;
    }

    const token = supplyAssets.find(t => t.symbol === tokenSymbol);
    if (!token) {
      console.log(`❌ Token ${tokenSymbol} not found`);
      return;
    }

    const cacheKey = `${address}_${tokenSymbol}_wallet`;
    
    // Check cache first
    const cached = balanceCache[cacheKey];
    if (cached && cached.isValid) {
      console.log(`✅ Using cached decrypted balance for ${tokenSymbol}`);
      setBalances(prev => ({
        ...prev,
        [tokenSymbol]: {
          ...prev[tokenSymbol],
          formattedBalance: cached.value,
          rawBalance: cached.rawValue,
          hasBalance: cached.rawValue > BigInt(0),
          isDecrypted: true,
          isLoading: false
        }
      }));
      return;
    }

    // Not in cache - decrypt from blockchain
    decryptingRefs.current[tokenSymbol] = true;
    setDecryptingTokens(prev => new Set(prev).add(tokenSymbol));
    setBalances(prev => ({
      ...prev,
      [tokenSymbol]: {
        ...prev[tokenSymbol],
        isLoading: true
      }
    }));

    console.log(`🔓 Decrypting balance for ${tokenSymbol}...`);

    try {
      // Get master signature object
      const masterSig = getMasterSignature();
      if (!masterSig) {
        throw new Error('Master signature not available');
      }

      // Fetch encrypted balance
      const rpcUrls = getSepoliaRpcUrls();
      let publicClient;
      
      for (const rpcUrl of rpcUrls) {
        try {
          publicClient = createPublicClient({
            chain: sepolia,
            transport: http(rpcUrl)
          });
          await publicClient.getBlockNumber();
          break;
        } catch (err) {
          continue;
        }
      }

      if (!publicClient) {
        throw new Error('Failed to connect to RPC');
      }

      const result = await publicClient.call({
        to: token.address as `0x${string}`,
        data: `0x70a08231000000000000000000000000${address.slice(2)}` as `0x${string}`
      });

      if (!result.data || result.data === '0x') {
        throw new Error('No balance data');
      }

      const encryptedBalance = result.data;

      // Get FHE instance and decrypt using master signature
      const fheInstance = await getFHEInstance();
      console.log('Using master signature for decryption...');

      const decryptResult = await fheInstance.userDecrypt(
        [{ handle: encryptedBalance, contractAddress: token.address as `0x${string}` }],
        masterSig.privateKey,
        masterSig.publicKey,
        masterSig.signature,
        masterSig.contractAddresses,
        masterSig.userAddress,
        masterSig.startTimestamp,
        masterSig.durationDays
      );

      const decryptedValue = decryptResult[encryptedBalance];
      let decrypted: bigint;
      
      if (typeof decryptedValue === 'bigint') {
        decrypted = decryptedValue;
      } else if (typeof decryptedValue === 'string') {
        decrypted = BigInt(decryptedValue);
      } else {
        decrypted = BigInt(0);
      }

      const formatted = formatUnits(decrypted, token.decimals);
      const displayValue = `${parseFloat(formatted).toFixed(token.decimals === 18 ? 4 : 2)} ${tokenSymbol}`;

      // Cache the decrypted value
      balanceCache[cacheKey] = {
        value: displayValue,
        rawValue: decrypted,
        timestamp: Date.now(),
        isValid: true
      };

      console.log(`✅ Decrypted ${tokenSymbol}:`, displayValue);

      // Update state
      setBalances(prev => ({
        ...prev,
        [tokenSymbol]: {
          ...prev[tokenSymbol],
          formattedBalance: displayValue,
          rawBalance: decrypted,
          hasBalance: decrypted > BigInt(0),
          isDecrypted: true,
          isLoading: false
        }
      }));
    } catch (error) {
      console.error(`Failed to decrypt balance for ${tokenSymbol}:`, error);
      
      // Show as encrypted on error
      setBalances(prev => ({
        ...prev,
        [tokenSymbol]: {
          ...prev[tokenSymbol],
          formattedBalance: '••••••••',
          rawBalance: null,
          isDecrypted: false,
          isLoading: false
        }
      }));
    } finally {
      decryptingRefs.current[tokenSymbol] = false;
      setDecryptingTokens(prev => {
        const next = new Set(prev);
        next.delete(tokenSymbol);
        return next;
      });
    }
  }, [address, masterSignature, isConnected, supplyAssets, getMasterSignature]);

  /**
   * Decrypt all token balances at once
   */
  const decryptAllBalances = useCallback(async () => {
    console.log('🔓 Decrypting all wallet balances...');
    const decryptPromises = supplyAssets.map(token => decryptBalance(token.symbol));
    await Promise.all(decryptPromises);
    console.log('✅ All balances decrypted');
  }, [supplyAssets, decryptBalance]);

  // Fetch encrypted balances on mount and when dependencies change
  useEffect(() => {
    if (address && supplyAssets.length > 0 && isConnected) {
      fetchEncryptedBalances();
    } else {
      setBalances({});
    }
  }, [address, supplyAssets, isConnected, fetchEncryptedBalances]);

  // Clear cache on disconnect
  useEffect(() => {
    if (!isConnected) {
      clearCache();
    }
  }, [isConnected, clearCache]);

  return {
    balances,
    isLoading,
    decryptingTokens,
    getBalance: (symbol: string) => balances[symbol] || null,
    decryptBalance,
    decryptAllBalances,
    invalidateToken,
    clearCache,
    refetch: fetchEncryptedBalances
  };
}
