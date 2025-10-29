'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { createPublicClient, http, formatUnits, encodeFunctionData } from 'viem';
import { sepolia } from 'wagmi/chains';
import { useAvailableReserves } from './useAvailableReserves';
import { getFHEInstance } from '../utils/fhe';
import { FhevmDecryptionSignature } from '../utils/FhevmDecryptionSignature';
import { getSepoliaRpcUrls } from '../utils/rpc';
import { getSafeContractAddresses } from '../config/contractConfig';
import { rpcCache, generateCacheKey, CACHE_TTL } from '../utils/rpcCache';

// Pool ABI for getUserSuppliedBalance
const POOL_ABI = [
  {
    "inputs": [
      { "internalType": "address", "name": "user", "type": "address" },
      { "internalType": "address", "name": "asset", "type": "address" }
    ],
    "name": "getUserSuppliedBalance",
    "outputs": [{ "internalType": "euint64", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

export interface SuppliedBalance {
  address: string;
  symbol: string;
  decimals: number;
  formattedSupplied: string;
  rawSupplied: bigint | null;
  hasSupplied: boolean;
  isDecrypted: boolean;
  isLoading: boolean;
}

/**
 * Hook to manage supplied balances for all tokens
 * Refactored to match the pattern from useConfidentialTokenBalance
 */
export function useSuppliedBalances(
  masterSignature: string | null,
  getMasterSignature: () => FhevmDecryptionSignature | null
) {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { supplyAssets } = useAvailableReserves();
  
  // Create stable reference for supply assets to prevent infinite loops
  const supplyAssetsKey = useMemo(() => {
    if (!supplyAssets || supplyAssets.length === 0) return '';
    return supplyAssets.map(t => t.address).sort().join(',');
  }, [supplyAssets]);
  
  // Core state - minimal and stable
  const [balances, setBalances] = useState<Record<string, SuppliedBalance>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [encryptedBalances, setEncryptedBalances] = useState<Record<string, string | null>>({});
  
  // Refs for stable references and preventing race conditions
  const decryptingRefs = useRef<Record<string, boolean>>({});
  const hasAutoDecryptedRef = useRef<Record<string, boolean>>({});
  const isFetchingRef = useRef<boolean>(false);
  const lastFetchedAssetsKeyRef = useRef<string>('');
  const decryptBalanceRef = useRef<((symbol: string) => Promise<void>) | null>(null);

  // Get contract addresses
  const contractAddresses = getSafeContractAddresses();
  const POOL_ADDRESS = contractAddresses?.POOL_ADDRESS;

  /**
   * Fetch encrypted supplied balance for a single token
   */
  const fetchEncryptedBalance = useCallback(async (token: { address: string; symbol: string; decimals: number }) => {
    if (!address || !POOL_ADDRESS) {
      return null;
    }

    // Check cache first to reduce API calls
    const cacheKey = generateCacheKey(POOL_ADDRESS, 'getUserSuppliedBalance', [address, token.address], address);
    const cachedData = rpcCache.get(cacheKey);
    
    if (cachedData) {
      console.log(`📦 Using cached encrypted balance for ${token.symbol}`);
      return cachedData;
    }

    try {
      const rpcUrls = getSepoliaRpcUrls();
      let publicClient;
      let lastError;
      
      // Try RPC URLs until one works
      for (const rpcUrl of rpcUrls) {
        try {
          publicClient = createPublicClient({
            chain: sepolia,
            transport: http(rpcUrl),
          });
          await publicClient.getBlockNumber();
          break;
        } catch (error) {
          lastError = error;
          continue;
        }
      }

      if (!publicClient) {
        throw new Error(`All RPC endpoints failed. Last error: ${lastError instanceof Error ? lastError.message : 'Unknown error'}`);
      }

      // Make contract call
      const result = await publicClient.call({
        to: POOL_ADDRESS as `0x${string}`,
        data: encodeFunctionData({
            abi: POOL_ABI,
            functionName: 'getUserSuppliedBalance',
            args: [address as `0x${string}`, token.address as `0x${string}`],
        }),
      });

      if (result.data && result.data !== '0x') {
        const balanceData = result.data as `0x${string}`;
        
        // Cache the result
        rpcCache.set(cacheKey, balanceData, CACHE_TTL.ENCRYPTED_DATA);
        
        return balanceData;
      }
      
      return null;
        } catch (error) {
      console.error(`Failed to fetch encrypted balance for ${token.symbol}:`, error);
          return null;
        }
  }, [address, POOL_ADDRESS]);

  /**
   * Fetch all encrypted supplied balances from Pool
   */
  const fetchAllEncryptedBalances = useCallback(async () => {
    if (!address || !POOL_ADDRESS || !supplyAssets || supplyAssets.length === 0) {
      setBalances({});
      setEncryptedBalances({});
      return;
    }

    // Prevent overlapping fetches
    if (isFetchingRef.current) {
      console.log('🔒 Already fetching balances, skipping...');
      return;
    }

    isFetchingRef.current = true;
    setIsLoading(true);
    console.log('📡 Fetching encrypted supplied balances for all tokens...');

    try {
      const newEncryptedBalances: Record<string, string | null> = {};
      const newBalances: Record<string, SuppliedBalance> = {};
      
      // Fetch all encrypted balances in parallel
      const results = await Promise.all(
        supplyAssets.map(async (token) => {
          const encryptedBalance = await fetchEncryptedBalance(token);
          return { token, encryptedBalance };
        })
      );

      // Process results
      results.forEach(({ token, encryptedBalance }) => {
        const hasEncryptedBalance = Boolean(
          encryptedBalance &&
          encryptedBalance !== '0x' &&
          encryptedBalance !== '0x0000000000000000000000000000000000000000000000000000000000000000'
        );

        newEncryptedBalances[token.symbol] = encryptedBalance;

          newBalances[token.symbol] = {
            address: token.address,
            symbol: token.symbol,
            decimals: token.decimals,
            formattedSupplied: '••••••••',
            rawSupplied: null,
          hasSupplied: hasEncryptedBalance,
            isDecrypted: false,
          isLoading: false,
          };

        console.log(`🔍 ${token.symbol}: hasSupplied=${hasEncryptedBalance}`);
      });

      setEncryptedBalances(newEncryptedBalances);
      setBalances(newBalances);
      
      console.log(`✅ Fetched encrypted balances for ${Object.keys(newBalances).length} tokens`);
    } catch (error) {
      console.error('Failed to fetch supplied balances:', error);
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [address, POOL_ADDRESS, supplyAssets, fetchEncryptedBalance]);

  /**
   * Decrypt supplied balance for a specific token
   * Follows the pattern from useConfidentialTokenBalance
   */
  const decryptBalance = useCallback(async (tokenSymbol: string) => {
    if (!isConnected || !address || !walletClient || !masterSignature || !POOL_ADDRESS) {
      console.log('Missing requirements for decryption:', {
        isConnected,
        address,
        walletClient: !!walletClient,
        masterSignature: !!masterSignature,
        POOL_ADDRESS
      });
      return;
    }

    // Prevent multiple simultaneous decryption attempts
    if (decryptingRefs.current[tokenSymbol]) {
      console.log(`🔒 ${tokenSymbol} decryption already in progress, skipping...`);
      return;
    }

    const token = supplyAssets.find(t => t.symbol === tokenSymbol);
    if (!token) {
      console.error(`❌ Token ${tokenSymbol} not found in supply assets`);
      return;
    }

    const encryptedBalance = encryptedBalances[tokenSymbol];
    if (!encryptedBalance || encryptedBalance === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      console.log(`❌ No encrypted balance for ${tokenSymbol}`);
      return;
    }

    decryptingRefs.current[tokenSymbol] = true;
    
    // Set loading state
    setBalances(prev => ({
      ...prev,
      [tokenSymbol]: {
        ...prev[tokenSymbol],
        isLoading: true
      }
    }));

    try {
      // Get the master signature object
      const masterSig = getMasterSignature();
      if (!masterSig) {
        throw new Error('Master signature not available');
      }

      // Verify authorization
      if (!POOL_ADDRESS || !masterSig.contractAddresses.includes(POOL_ADDRESS as `0x${string}`)) {
        console.warn('⚠️ Master signature not authorized for POOL contract', {
          poolAddress: POOL_ADDRESS,
          authorizedAddresses: masterSig.contractAddresses
        });
      }

      // Get FHE instance
      const fheInstance = await getFHEInstance();
      
      console.log(`🔓 Decrypting supplied balance for ${tokenSymbol}...`);

      // Decrypt balance using master signature
      const result = await fheInstance.userDecrypt(
        [{ handle: encryptedBalance, contractAddress: POOL_ADDRESS as `0x${string}` }],
        masterSig.privateKey,
        masterSig.publicKey,
        masterSig.signature,
        masterSig.contractAddresses,
        masterSig.userAddress,
        masterSig.startTimestamp,
        masterSig.durationDays
      );

      const decryptedValue = result[encryptedBalance];
      if (decryptedValue !== undefined) {
      let decrypted: bigint;
      
      if (typeof decryptedValue === 'bigint') {
        decrypted = decryptedValue;
      } else if (typeof decryptedValue === 'string') {
        decrypted = BigInt(decryptedValue);
      } else {
        decrypted = BigInt(0);
      }

        const tokenValue = Number(decrypted) / Math.pow(10, token.decimals);
        // Use 8 decimal places to match useConfidentialTokenBalance precision
        const formattedBalance = `${tokenValue.toFixed(8)} ${tokenSymbol}`;
        
        console.log(`✅ Supplied balance decrypted successfully for ${tokenSymbol}: ${formattedBalance}`);

      setBalances(prev => ({
        ...prev,
        [tokenSymbol]: {
          ...prev[tokenSymbol],
            formattedSupplied: formattedBalance,
          rawSupplied: decrypted,
          hasSupplied: decrypted > BigInt(0),
          isDecrypted: true,
          isLoading: false
        }
      }));
      }
    } catch (error: any) {
      console.error(`Failed to decrypt supplied balance for ${tokenSymbol}:`, error);
      
      // Handle authorization errors
      if (error.message && error.message.includes('not authorized')) {
        console.warn('🚫 Authorization error during decryption. Clearing cache.');
        localStorage.removeItem(`fhe_master_decryption_${address}`);
      }
      
      setBalances(prev => ({
        ...prev,
        [tokenSymbol]: {
          ...prev[tokenSymbol],
          formattedSupplied: '••••••••',
          isDecrypted: false,
          isLoading: false
        }
      }));
    } finally {
      decryptingRefs.current[tokenSymbol] = false;
    }
  }, [isConnected, address, walletClient, masterSignature, POOL_ADDRESS, supplyAssets, encryptedBalances, getMasterSignature]);

  // Keep ref updated with latest decrypt function
  useEffect(() => {
    decryptBalanceRef.current = decryptBalance;
  }, [decryptBalance]);

  /**
   * Decrypt all supplied balances at once
   */
  const decryptAllBalances = useCallback(async () => {
    if (!masterSignature || !decryptBalanceRef.current) {
      console.log('❌ Cannot decrypt all: no master signature or decrypt function');
      return;
    }

    console.log('🔓 Decrypting all supplied balances...');
    
    const tokensToDecrypt = Object.keys(encryptedBalances).filter(symbol => {
      const encryptedBalance = encryptedBalances[symbol];
      const hasEncryptedBalance = Boolean(
        encryptedBalance &&
        encryptedBalance !== '0x' &&
        encryptedBalance !== '0x0000000000000000000000000000000000000000000000000000000000000000'
      );
      return hasEncryptedBalance && !decryptingRefs.current[symbol];
    });

    if (tokensToDecrypt.length === 0) {
      console.log('✅ No tokens need decryption');
      return;
    }

    await Promise.all(tokensToDecrypt.map(symbol => decryptBalanceRef.current!(symbol)));
    console.log('✅ All supplied balances decrypted');
  }, [masterSignature, encryptedBalances]);

  /**
   * Force refresh all balances (used after transactions)
   */
  const forceRefresh = useCallback(async () => {
    console.log('🔄 Force refreshing all supplied balances...');
    
    // Reset auto-decrypt flags to allow re-decryption
    hasAutoDecryptedRef.current = {};
    
    // Fetch latest balances
    await fetchAllEncryptedBalances();
    
    // The auto-decrypt effect will trigger automatically when encryptedBalances updates
  }, [fetchAllEncryptedBalances]);

  /**
   * Lock all balances (hide decrypted values)
   */
  const lockBalances = useCallback(() => {
    if (!masterSignature) {
      console.log('🔒 Locking all supplied balances');
      setBalances(prev => {
        const locked: Record<string, SuppliedBalance> = {};
        Object.entries(prev).forEach(([symbol, balance]) => {
          locked[symbol] = {
            ...balance,
            formattedSupplied: '••••••••',
            isDecrypted: false
          };
        });
        return locked;
      });
    }
  }, [masterSignature]);

  // Initialize: fetch encrypted balances when address/connection changes
  // Be resilient to brief reserve discovery hiccups: do not wipe state if assets list is momentarily empty.
  useEffect(() => {
    // Must have address, connection and pool to proceed
    if (!address || !isConnected || !POOL_ADDRESS) {
      setBalances({});
      setEncryptedBalances({});
      lastFetchedAssetsKeyRef.current = '';
      return;
    }

    // If assets list isn't ready yet, don't wipe existing state; wait for the next update
    if (!supplyAssetsKey) {
      return;
    }

    // Only fetch if the assets have actually changed
    if (lastFetchedAssetsKeyRef.current !== supplyAssetsKey) {
      console.log('🔄 Address connected, fetching encrypted balances...');
      lastFetchedAssetsKeyRef.current = supplyAssetsKey;
      fetchAllEncryptedBalances();
    }
  }, [address, isConnected, POOL_ADDRESS, supplyAssetsKey, fetchAllEncryptedBalances]);

  // Smart auto-decrypt effect - ONLY decrypt once when master signature is available
  // This EXACTLY matches the pattern from useConfidentialTokenBalance (lines 416-448)
  useEffect(() => {
    // Only auto-decrypt when we have:
    // 1. Master signature
    // 2. Encrypted balances available
    // 3. Not currently loading
    // 4. Connected wallet client
    if (
      masterSignature && 
      !isLoading && 
      walletClient &&
      isConnected &&
      Object.keys(encryptedBalances).length > 0
    ) {
      // Find tokens that need decryption
      const tokensNeedingDecrypt: string[] = [];
      
      Object.entries(encryptedBalances).forEach(([symbol, encryptedBalance]) => {
        const hasEncryptedBalance = Boolean(
          encryptedBalance &&
          encryptedBalance !== '0x' &&
          encryptedBalance !== '0x0000000000000000000000000000000000000000000000000000000000000000'
        );
        
        const balance = balances[symbol];
        const hasAutoDecrypted = hasAutoDecryptedRef.current[symbol];
        const isCurrentlyDecrypting = decryptingRefs.current[symbol];
        const isAlreadyDecrypted = balance?.isDecrypted;
        
        // Decrypt if we have encrypted data and haven't decrypted yet
        if (
          hasEncryptedBalance &&
          !hasAutoDecrypted &&
          !isCurrentlyDecrypting &&
          !isAlreadyDecrypted
        ) {
          tokensNeedingDecrypt.push(symbol);
        }
      });

      if (tokensNeedingDecrypt.length > 0) {
        console.log(`🔄 Initial auto-decryption after master signature for ${tokensNeedingDecrypt.length} token(s): ${tokensNeedingDecrypt.join(', ')}`);
        
        // Mark as auto-decrypted
        tokensNeedingDecrypt.forEach(symbol => {
          hasAutoDecryptedRef.current[symbol] = true;
        });
        
        // Decrypt after a short delay to avoid race conditions
        const timeoutId = setTimeout(() => {
          tokensNeedingDecrypt.forEach(symbol => {
            if (!decryptingRefs.current[symbol] && decryptBalanceRef.current) {
              decryptBalanceRef.current(symbol);
            }
          });
        }, 200);
        
        return () => clearTimeout(timeoutId);
      }
    } else if (!masterSignature && Object.keys(balances).some(k => balances[k]?.isDecrypted)) {
      // Reset auto-decrypt flags and lock balances when signature is lost
      console.log('🔒 Master signature lost - locking supplied balances');
      hasAutoDecryptedRef.current = {};
      setBalances(prev => {
        const locked: Record<string, SuppliedBalance> = {};
        Object.entries(prev).forEach(([symbol, balance]) => {
          locked[symbol] = {
            ...balance,
            formattedSupplied: '••••••••',
            isDecrypted: false
          };
        });
        return locked;
      });
    }
  }, [masterSignature, encryptedBalances, isLoading, walletClient, isConnected, balances]); // Minimal deps to prevent loops

  // Cleanup on disconnect
  useEffect(() => {
    if (!isConnected) {
      setBalances({});
      setEncryptedBalances({});
      hasAutoDecryptedRef.current = {};
    }
  }, [isConnected]);

  // Periodic cache cleanup
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      rpcCache.cleanup();
    }, 60000); // Clean every minute

    return () => clearInterval(cleanupInterval);
  }, []);

  return {
    balances,
    isLoading,
    getSupplied: (symbol: string) => balances[symbol] || null,
    decryptBalance,
    decryptAllBalances,
    forceRefresh,
    lockBalances,
    refetch: fetchAllEncryptedBalances,
  };
}
