'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { createPublicClient, http, encodeFunctionData } from 'viem';
import { sepolia } from 'wagmi/chains';
import { useAvailableReserves } from './useAvailableReserves';
import { getFHEInstance } from '../utils/fhe';
import { FhevmDecryptionSignature } from '../utils/FhevmDecryptionSignature';
import { getSepoliaRpcUrls } from '../utils/rpc';
import { CONTRACTS } from '../config/contracts';
import { rpcCache, generateCacheKey, CACHE_TTL } from '../utils/rpcCache';

// Pool ABI for getUserBorrowedBalance
const POOL_ABI = [
  {
    inputs: [
      { internalType: 'address', name: 'user', type: 'address' },
      { internalType: 'address', name: 'asset', type: 'address' },
    ],
    name: 'getUserBorrowedBalance',
    outputs: [{ internalType: 'euint64', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export interface BorrowedBalance {
  address: string;
  symbol: string;
  decimals: number;
  formattedBorrowed: string;
  rawBorrowed: bigint | null;
  hasBorrowed: boolean;
  isDecrypted: boolean;
  isLoading: boolean;
}

/**
 * Hook to manage borrowed balances for all borrowable tokens
 * Mirrors the structure of useSuppliedBalances for consistency
 */
export function useBorrowedBalances(
  masterSignature: string | null,
  getMasterSignature: () => FhevmDecryptionSignature | null
) {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { borrowAssets } = useAvailableReserves();

  // Stable key of borrow assets to avoid unnecessary refetches
  const borrowAssetsKey = useMemo(() => {
    if (!borrowAssets || borrowAssets.length === 0) return '';
    return borrowAssets.map((t) => t.address).sort().join(',');
  }, [borrowAssets]);

  // Core state
  const [balances, setBalances] = useState<Record<string, BorrowedBalance>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [encryptedBalances, setEncryptedBalances] = useState<Record<string, string | null>>({});

  // Concurrency guards
  const decryptingRefs = useRef<Record<string, boolean>>({});
  const hasAutoDecryptedRef = useRef<Record<string, boolean>>({});
  const isFetchingRef = useRef<boolean>(false);
  const lastFetchedAssetsKeyRef = useRef<string>('');
  const decryptBalanceRef = useRef<((symbol: string) => Promise<void>) | null>(null);

  /**
   * Fetch encrypted borrowed balance for a single token
   */
  const fetchEncryptedBalance = useCallback(
    async (token: { address: string; symbol: string; decimals: number }) => {
      if (!address) {
        return null;
      }

      // Cache lookup
      const cacheKey = generateCacheKey(
        CONTRACTS.LENDING_POOL,
        'getUserBorrowedBalance',
        [address, token.address],
        address
      );
      const cached = rpcCache.get(cacheKey);
      if (cached) {
        console.log(`📦 Using cached encrypted borrowed balance for ${token.symbol}`);
        return cached;
      }

      try {
        const rpcUrls = getSepoliaRpcUrls();
        let publicClient: any;
        let lastError: any;

        for (const rpcUrl of rpcUrls) {
          try {
            publicClient = createPublicClient({
              chain: sepolia,
              transport: http(rpcUrl),
            });
            await publicClient.getBlockNumber();
            break;
          } catch (err) {
            lastError = err;
            continue;
          }
        }

        if (!publicClient) {
          throw new Error(
            `All RPC endpoints failed for borrowed balance. Last error: ${
              lastError instanceof Error ? lastError.message : 'Unknown'
            }`
          );
        }

        const result = await publicClient.call({
          to: CONTRACTS.LENDING_POOL as `0x${string}`,
          data: encodeFunctionData({
            abi: POOL_ABI,
            functionName: 'getUserBorrowedBalance',
            args: [address as `0x${string}`, token.address as `0x${string}`],
          }),
        });

        if (result.data && result.data !== '0x') {
          const data = result.data as `0x${string}`;
          rpcCache.set(cacheKey, data, CACHE_TTL.ENCRYPTED_DATA);
          return data;
        }

        return null;
      } catch (error) {
        console.error(`Failed to fetch encrypted borrowed balance for ${token.symbol}:`, error);
        return null;
      }
    },
    [address]
  );

  /**
   * Fetch all encrypted borrowed balances
   */
  const fetchAllEncryptedBalances = useCallback(async () => {
    if (!address || !borrowAssets || borrowAssets.length === 0) {
      setBalances({});
      setEncryptedBalances({});
      return;
    }

    if (isFetchingRef.current) {
      console.log('🔒 Already fetching borrowed balances, skipping...');
      return;
    }

    isFetchingRef.current = true;
    setIsLoading(true);
    console.log('📡 Fetching encrypted borrowed balances for all tokens...');

    try {
      const newEncrypted: Record<string, string | null> = {};
      const newBalances: Record<string, BorrowedBalance> = {};

      const results = await Promise.all(
        borrowAssets.map(async (token) => {
          const enc = await fetchEncryptedBalance(token);
          return { token, enc };
        })
      );

      results.forEach(({ token, enc }) => {
        const hasEnc =
          !!enc &&
          enc !== '0x' &&
          enc !==
            '0x0000000000000000000000000000000000000000000000000000000000000000';

        newEncrypted[token.symbol] = enc;

        newBalances[token.symbol] = {
          address: token.address,
          symbol: token.symbol,
          decimals: token.decimals,
          formattedBorrowed: '••••••••',
          rawBorrowed: null,
          hasBorrowed: hasEnc,
          isDecrypted: false,
          isLoading: false,
        };

        console.log(`🔍 ${token.symbol}: hasBorrowed=${hasEnc}`);
      });

      setEncryptedBalances(newEncrypted);
      setBalances(newBalances);
      console.log(`✅ Fetched encrypted borrowed balances for ${Object.keys(newBalances).length} tokens`);
    } catch (error) {
      console.error('Failed to fetch borrowed balances:', error);
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [address, borrowAssets, fetchEncryptedBalance]);

  /**
   * Decrypt borrowed balance for a specific token
   */
  const decryptBalance = useCallback(
    async (tokenSymbol: string) => {
      if (!isConnected || !address || !walletClient || !masterSignature) {
        console.log('Missing requirements for borrowed decryption:', {
          isConnected,
          address,
          walletClient: !!walletClient,
          masterSignature: !!masterSignature,
        });
        return;
      }

      if (decryptingRefs.current[tokenSymbol]) {
        console.log(`🔒 ${tokenSymbol} borrowed decryption already in progress, skipping...`);
        return;
      }

      const token = borrowAssets.find((t) => t.symbol === tokenSymbol);
      if (!token) {
        console.error(`❌ Token ${tokenSymbol} not found in borrow assets`);
        return;
      }

      const encryptedBalance = encryptedBalances[tokenSymbol];
      if (
        !encryptedBalance ||
        encryptedBalance ===
          '0x0000000000000000000000000000000000000000000000000000000000000000'
      ) {
        console.log(`❌ No encrypted borrowed balance for ${tokenSymbol}`);
        return;
      }

      decryptingRefs.current[tokenSymbol] = true;

      // Set loading state
      setBalances((prev) => ({
        ...prev,
        [tokenSymbol]: {
          ...prev[tokenSymbol],
          isLoading: true,
        },
      }));

      try {
        // Get master signature object
        const masterSig = getMasterSignature();
        if (!masterSig) {
          throw new Error('Master signature not available');
        }

        // Get FHE instance
        const fheInstance = await getFHEInstance();

        console.log(`🔓 Decrypting borrowed balance for ${tokenSymbol}...`);

        const result = await fheInstance.userDecrypt(
          [{ handle: encryptedBalance, contractAddress: CONTRACTS.LENDING_POOL as `0x${string}` }],
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
          const formatted = `${tokenValue.toFixed(8)} ${tokenSymbol}`;

          console.log(`✅ Borrowed balance decrypted for ${tokenSymbol}: ${formatted}`);

          setBalances((prev) => ({
            ...prev,
            [tokenSymbol]: {
              ...prev[tokenSymbol],
              formattedBorrowed: formatted,
              rawBorrowed: decrypted,
              hasBorrowed: decrypted > BigInt(0),
              isDecrypted: true,
              isLoading: false,
            },
          }));
        }
      } catch (error: any) {
        console.error(`Failed to decrypt borrowed balance for ${tokenSymbol}:`, error);

        setBalances((prev) => ({
          ...prev,
          [tokenSymbol]: {
            ...prev[tokenSymbol],
            formattedBorrowed: '••••••••',
            isDecrypted: false,
            isLoading: false,
          },
        }));
      } finally {
        decryptingRefs.current[tokenSymbol] = false;
      }
    },
    [
      isConnected,
      address,
      walletClient,
      masterSignature,
      borrowAssets,
      encryptedBalances,
      getMasterSignature,
    ]
  );

  // Keep decrypt function current
  useEffect(() => {
    decryptBalanceRef.current = decryptBalance;
  }, [decryptBalance]);

  /**
   * Decrypt all borrowed balances at once
   */
  const decryptAllBalances = useCallback(async () => {
    if (!masterSignature || !decryptBalanceRef.current) {
      console.log('❌ Cannot decrypt all borrowed: no master signature or decrypt function');
      return;
    }

    console.log('🔓 Decrypting all borrowed balances...');

    const tokens = Object.keys(encryptedBalances).filter((symbol) => {
      const enc = encryptedBalances[symbol];
      const hasEnc =
        !!enc &&
        enc !== '0x' &&
        enc !==
          '0x0000000000000000000000000000000000000000000000000000000000000000';
      return hasEnc && !decryptingRefs.current[symbol];
    });

    if (tokens.length === 0) {
      console.log('✅ No borrowed tokens need decryption');
      return;
    }

    await Promise.all(tokens.map((s) => decryptBalanceRef.current!(s)));
    console.log('✅ All borrowed balances decrypted');
  }, [masterSignature, encryptedBalances]);

  /**
   * Force refresh borrowed balances (use after borrow/repay)
   */
  const forceRefresh = useCallback(async () => {
    console.log('🔄 Force refreshing all borrowed balances...');
    hasAutoDecryptedRef.current = {};
    await fetchAllEncryptedBalances();
  }, [fetchAllEncryptedBalances]);

  /**
   * Initialize: fetch encrypted balances when address/connection changes
   * Be resilient to brief reserve discovery hiccups: do not wipe state if assets list is momentarily empty.
   */
  useEffect(() => {
    if (!address || !isConnected) {
      setBalances({});
      setEncryptedBalances({});
      lastFetchedAssetsKeyRef.current = '';
      return;
    }

    // If assets list isn't ready yet, don't wipe; wait for next update
    if (!borrowAssetsKey) {
      return;
    }

    if (lastFetchedAssetsKeyRef.current !== borrowAssetsKey) {
      console.log('🔄 Address connected, fetching encrypted borrowed balances...');
      lastFetchedAssetsKeyRef.current = borrowAssetsKey;
      fetchAllEncryptedBalances();
    }
  }, [address, isConnected, borrowAssetsKey, fetchAllEncryptedBalances]);

  /**
   * Smart auto-decrypt once master signature is available
   * Minimal dependencies to prevent infinite loops
   */
  useEffect(() => {
    if (
      masterSignature &&
      !isLoading &&
      walletClient &&
      isConnected &&
      Object.keys(encryptedBalances).length > 0
    ) {
      const tokensNeedingDecrypt: string[] = [];

      Object.entries(encryptedBalances).forEach(([symbol, enc]) => {
        const hasEnc =
          !!enc &&
          enc !== '0x' &&
          enc !==
            '0x0000000000000000000000000000000000000000000000000000000000000000';

        const bal = balances[symbol];
        const auto = hasAutoDecryptedRef.current[symbol];
        const isDec = bal?.isDecrypted;
        const inProg = decryptingRefs.current[symbol];

        if (hasEnc && !auto && !inProg && !isDec) {
          tokensNeedingDecrypt.push(symbol);
        }
      });

      if (tokensNeedingDecrypt.length > 0) {
        console.log(
          `🔄 Initial borrowed auto-decryption for ${tokensNeedingDecrypt.length} token(s): ${tokensNeedingDecrypt.join(
            ', '
          )}`
        );

        tokensNeedingDecrypt.forEach((s) => {
          hasAutoDecryptedRef.current[s] = true;
        });

        const timeoutId = setTimeout(() => {
          tokensNeedingDecrypt.forEach((s) => {
            if (!decryptingRefs.current[s] && decryptBalanceRef.current) {
              decryptBalanceRef.current(s);
            }
          });
        }, 200);

        return () => clearTimeout(timeoutId);
      }
    } else if (!masterSignature && Object.keys(balances).some((k) => balances[k]?.isDecrypted)) {
      console.log('🔒 Master signature lost - locking borrowed balances');
      hasAutoDecryptedRef.current = {};
      setBalances((prev) => {
        const locked: Record<string, BorrowedBalance> = {};
        Object.entries(prev).forEach(([symbol, bal]) => {
          locked[symbol] = {
            ...bal,
            formattedBorrowed: '••••••••',
            isDecrypted: false,
          };
        });
        return locked;
      });
    }
  }, [masterSignature, encryptedBalances, isLoading, walletClient, isConnected, balances]);

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
    const id = setInterval(() => {
      rpcCache.cleanup();
    }, 60000);
    return () => clearInterval(id);
  }, []);

  return {
    balances,
    isLoading,
    getBorrowed: (symbol: string) => balances[symbol] || null,
    decryptBalance,
    decryptAllBalances,
    forceRefresh,
    refetch: fetchAllEncryptedBalances,
  };
}
