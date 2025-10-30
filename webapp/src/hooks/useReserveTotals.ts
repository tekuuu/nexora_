'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { createPublicClient, http, encodeFunctionData, decodeFunctionResult } from 'viem';
import { sepolia } from 'wagmi/chains';
import { useAvailableReserves } from './useAvailableReserves';
import { getFHEInstance } from '../utils/fhe';
import { FhevmDecryptionSignature } from '../utils/FhevmDecryptionSignature';
import { getSepoliaRpcUrls } from '../utils/rpc';
import { CONTRACTS } from '../config/contracts';
import { rpcCache, generateCacheKey, CACHE_TTL } from '../utils/rpcCache';
import { POOL_ABI } from '../config/poolABI';

export interface ReserveTotals {
  address: string;
  symbol: string;
  decimals: number;
  formattedTotalSupplied: string;
  formattedTotalBorrowed: string;
  rawTotalSupplied: bigint | null;
  rawTotalBorrowed: bigint | null;
  isDecrypted: boolean;
  isLoading: boolean;
}

export function useReserveTotals(
  masterSignature: string | null,
  getMasterSignature: () => FhevmDecryptionSignature | null
) {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { supplyAssets } = useAvailableReserves();

  const supplyAssetsKey = useMemo(() => {
    if (!supplyAssets || supplyAssets.length === 0) return '';
    return supplyAssets.map(t => t.address).sort().join(',');
  }, [supplyAssets]);

  const [totals, setTotals] = useState<Record<string, ReserveTotals>>({});
  const [encrypted, setEncrypted] = useState<Record<string, { supplied: `0x${string}` | null; borrowed: `0x${string}` | null }>>({});
  const [isLoading, setIsLoading] = useState(false);

  const decryptingRefs = useRef<Record<string, boolean>>({});
  const isFetchingRef = useRef<boolean>(false);
  const lastFetchedAssetsKeyRef = useRef<string>('');
  const decryptTotalsRef = useRef<((symbol: string) => Promise<void>) | null>(null);

  // Anti-spam controls (match pattern used in other hooks)
  const hasAutoDecryptedRef = useRef<Record<string, boolean>>({});
  const decryptQueueRef = useRef<string[]>([]);
  const isProcessingQueueRef = useRef<boolean>(false);
  const [isDecryptingTotals, setIsDecryptingTotals] = useState(false);

  const toHex32 = (v: any): `0x${string}` => {
    if (typeof v === 'string') {
      if (v.startsWith('0x')) {
        return v as `0x${string}`;
      }
      const bi = BigInt(v);
      return ('0x' + bi.toString(16).padStart(64, '0')) as `0x${string}`;
    }
    if (typeof v === 'bigint') {
      return ('0x' + v.toString(16).padStart(64, '0')) as `0x${string}`;
    }
    if (v instanceof Uint8Array) {
      return ('0x' + Array.from(v).map(b => b.toString(16).padStart(2, '0')).join('')) as `0x${string}`;
    }
    // fallback
    return '0x' + ''.padStart(64, '0') as `0x${string}`;
  };

  const fetchEncryptedForToken = useCallback(async (token: { address: string; symbol: string; decimals: number }) => {
    // cache keys per field
    const cacheKeyS = generateCacheKey(CONTRACTS.LENDING_POOL, 'reserve.totalSupplied', [token.address], 'GLOBAL');
    const cacheKeyB = generateCacheKey(CONTRACTS.LENDING_POOL, 'reserve.totalBorrowed', [token.address], 'GLOBAL');
    const cachedS = rpcCache.get(cacheKeyS);
    const cachedB = rpcCache.get(cacheKeyB);
    if (cachedS && cachedB) {
      return { supplied: cachedS as `0x${string}`, borrowed: cachedB as `0x${string}` };
    }

    const rpcUrls = getSepoliaRpcUrls();
    let publicClient: any;
    let lastErr: any;
    for (const url of rpcUrls) {
      try {
        publicClient = createPublicClient({ chain: sepolia, transport: http(url) });
        await publicClient.getBlockNumber();
        break;
      } catch (e) {
        lastErr = e;
        continue;
      }
    }
    if (!publicClient) {
      throw new Error(`All RPC endpoints failed (reserve totals). Last error: ${lastErr instanceof Error ? lastErr.message : 'unknown'}`);
    }

    const call = await publicClient.call({
      to: CONTRACTS.LENDING_POOL as `0x${string}`,
      data: encodeFunctionData({
        abi: POOL_ABI,
        functionName: 'getReserveData',
        args: [token.address as `0x${string}`]
      }),
      account: (address as undefined | `0x${string}`)
    });
    if (!call.data || call.data === '0x') {
      return { supplied: null, borrowed: null };
    }
    const decoded = decodeFunctionResult({
      abi: POOL_ABI,
      functionName: 'getReserveData',
      data: call.data as `0x${string}`,
    }) as any;

    // Extract totalSupplied and totalBorrowed handles from the tuple (indexes 1 and 2)
    const tuple = Array.isArray(decoded) ? decoded : [];
    const sRaw = tuple[1];
    const bRaw = tuple[2];

    const sHex = sRaw ? toHex32(sRaw) : null;
    const bHex = bRaw ? toHex32(bRaw) : null;

    if (sHex) rpcCache.set(cacheKeyS, sHex, CACHE_TTL.ENCRYPTED_DATA);
    if (bHex) rpcCache.set(cacheKeyB, bHex, CACHE_TTL.ENCRYPTED_DATA);
    return { supplied: sHex, borrowed: bHex };
  }, []);


  const fetchAllEncrypted = useCallback(async () => {
    if (!supplyAssets || supplyAssets.length === 0) {
      setEncrypted({});
      setTotals({});
      return;
    }
    if (isFetchingRef.current) {
      console.log('🔒 Already fetching reserve totals, skipping...');
      return;
    }
    isFetchingRef.current = true;
    setIsLoading(true);
    try {
      const results = await Promise.all(
        supplyAssets.map(async (t) => {
          const enc = await fetchEncryptedForToken(t);
          return { token: t, enc };
        })
      );
      const newEncrypted: Record<string, { supplied: `0x${string}` | null; borrowed: `0x${string}` | null }> = {};
      const newTotals: Record<string, ReserveTotals> = {};
      results.forEach(({ token, enc }) => {
        newEncrypted[token.symbol] = { supplied: enc.supplied, borrowed: enc.borrowed };
        newTotals[token.symbol] = {
          address: token.address,
          symbol: token.symbol,
          decimals: token.decimals,
          formattedTotalSupplied: '••••••••',
          formattedTotalBorrowed: '••••••••',
          rawTotalSupplied: null,
          rawTotalBorrowed: null,
          isDecrypted: false,
          isLoading: false
        };
        console.log(`📊 Reserve ${token.symbol}: has totals enc S=${!!enc.supplied} B=${!!enc.borrowed}`);
      });
      setEncrypted(newEncrypted);
      setTotals(newTotals);
    } catch (e) {
      console.error('Failed to fetch reserve totals:', e);
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [supplyAssets, fetchEncryptedForToken]);

  const decryptTotals = useCallback(async (tokenSymbol: string) => {
    if (!isConnected) {
      console.log('Missing requirements to decrypt reserve totals:', {
        isConnected,
        poolAddress: CONTRACTS.LENDING_POOL
      });
      return;
    }

    const enc = encrypted[tokenSymbol];
    if (!enc || (!enc.supplied && !enc.borrowed)) {
      console.log(`No encrypted totals for ${tokenSymbol}`);
      return;
    }
    if (decryptingRefs.current[tokenSymbol]) {
      console.log(`🔒 ${tokenSymbol} totals decryption already in progress, skipping...`);
      return;
    }

    decryptingRefs.current[tokenSymbol] = true;
    setTotals(prev => ({
      ...prev,
      [tokenSymbol]: { ...prev[tokenSymbol], isLoading: true }
    }));

    try {
      const fhe = await getFHEInstance();

      let res: Record<string, any> | null = null;

      // Preferred path: publicDecrypt batch (no signature required)
      try {
        const handlesToDecrypt: `0x${string}`[] = [];
        if (enc.supplied) handlesToDecrypt.push(enc.supplied);
        if (enc.borrowed) handlesToDecrypt.push(enc.borrowed);

        if (typeof (fhe as any).publicDecrypt === 'function' && handlesToDecrypt.length > 0) {
          console.log(`🔓 publicDecrypt reserve totals for ${tokenSymbol} (batch=${handlesToDecrypt.length})`);
          res = await (fhe as any).publicDecrypt(handlesToDecrypt);
        }
      } catch (pubErr) {
        console.warn(`publicDecrypt failed for ${tokenSymbol}, will try userDecrypt fallback`, pubErr);
      }

      // Fallback path: userDecrypt with master signature (if available)
      if (!res) {
        const masterSig = getMasterSignature && getMasterSignature();
        if (!masterSig) {
          throw new Error('No publicDecrypt result and master signature not available');
        }

        const handles: { handle: `0x${string}`; contractAddress: `0x${string}` }[] = [];
        if (enc.supplied) handles.push({ handle: enc.supplied, contractAddress: CONTRACTS.LENDING_POOL as `0x${string}` });
        if (enc.borrowed) handles.push({ handle: enc.borrowed, contractAddress: CONTRACTS.LENDING_POOL as `0x${string}` });

        res = await (fhe as any).userDecrypt(
          handles,
          masterSig.privateKey,
          masterSig.publicKey,
          masterSig.signature,
          masterSig.contractAddresses,
          masterSig.userAddress,
          masterSig.startTimestamp,
          masterSig.durationDays
        );
      }
      if (!res) {
        throw new Error(`Failed to decrypt reserve totals for ${tokenSymbol}: no decryption result`);
      }

      // TypeScript knows res is not null from the above logic if(!res)
      const sVal = enc.supplied ? res[enc.supplied] : undefined;
      const bVal = enc.borrowed ? res[enc.borrowed] : undefined;

      const token = supplyAssets.find(t => t.symbol === tokenSymbol);
      const decimals = token?.decimals ?? 18;

      let sup: bigint | null = null;
      let bor: bigint | null = null;
      if (sVal !== undefined) sup = typeof sVal === 'bigint' ? sVal : BigInt(sVal);
      if (bVal !== undefined) bor = typeof bVal === 'bigint' ? bVal : BigInt(bVal);

      const fmtSup = sup !== null ? (Number(sup) / Math.pow(10, decimals)).toFixed(8) + ` ${tokenSymbol}` : '0';
      const fmtBor = bor !== null ? (Number(bor) / Math.pow(10, decimals)).toFixed(8) + ` ${tokenSymbol}` : '0';

      setTotals(prev => ({
        ...prev,
        [tokenSymbol]: {
          ...prev[tokenSymbol],
          rawTotalSupplied: sup,
          rawTotalBorrowed: bor,
          formattedTotalSupplied: sup !== null ? fmtSup : prev[tokenSymbol]?.formattedTotalSupplied ?? '0',
          formattedTotalBorrowed: bor !== null ? fmtBor : prev[tokenSymbol]?.formattedTotalBorrowed ?? '0',
          isDecrypted: (sup ?? BigInt(0)) >= BigInt(0) || (bor ?? BigInt(0)) >= BigInt(0),
          isLoading: false
        }
      }));

      console.log(`✅ Decrypted totals for ${tokenSymbol}: S=${fmtSup} B=${fmtBor}`);
    } catch (e) {
      console.error(`Failed to decrypt reserve totals for ${tokenSymbol}:`, e);
      // Final failure state
      setTotals(prev => ({
        ...prev,
        [tokenSymbol]: { ...prev[tokenSymbol], isDecrypted: false, isLoading: false }
      }));
    } finally {
      decryptingRefs.current[tokenSymbol] = false;
    }
  }, [isConnected, encrypted, getMasterSignature, supplyAssets]);

  useEffect(() => {
    decryptTotalsRef.current = decryptTotals;
  }, [decryptTotals]);

  // Queue-based sequential decryption to prevent RPC/relayer spam
  const processDecryptQueue = useCallback(async () => {
    if (isProcessingQueueRef.current) return;
    isProcessingQueueRef.current = true;
    setIsDecryptingTotals(true);
    try {
      while (decryptQueueRef.current.length > 0) {
        const symbol = decryptQueueRef.current.shift()!;
        if (decryptingRefs.current[symbol]) continue;
        if (decryptTotalsRef.current) {
          await decryptTotalsRef.current(symbol);
          // Small delay to avoid bursts
          await new Promise((res) => setTimeout(res, 250));
        }
      }
    } finally {
      isProcessingQueueRef.current = false;
      setIsDecryptingTotals(false);
    }
  }, []);

  const enqueueDecryptSymbol = useCallback((symbol: string) => {
    if (!symbol) return;
    if (decryptingRefs.current[symbol]) return;
    if (!decryptQueueRef.current.includes(symbol)) {
      decryptQueueRef.current.push(symbol);
    }
  }, []);

  const scheduleDecryptTotals = useCallback((symbol: string) => {
    enqueueDecryptSymbol(symbol);
    if (!isProcessingQueueRef.current) {
      void processDecryptQueue();
    }
  }, [enqueueDecryptSymbol, processDecryptQueue]);

  const scheduleDecryptAllTotals = useCallback(() => {
    Object.keys(encrypted).forEach((s) => {
      const enc = encrypted[s];
      const needs = !!enc && (enc.supplied || enc.borrowed) && !decryptingRefs.current[s];
      if (needs) enqueueDecryptSymbol(s);
    });
    if (!isProcessingQueueRef.current) {
      void processDecryptQueue();
    }
  }, [encrypted, enqueueDecryptSymbol, processDecryptQueue]);

  const decryptAllTotals = useCallback(async () => {
    // Schedule sequential decryption to avoid bursts
    scheduleDecryptAllTotals();
  }, [scheduleDecryptAllTotals]);

  const forceRefresh = useCallback(async () => {
    console.log('🔄 Force refreshing reserve totals...');
    await fetchAllEncrypted();
  }, [fetchAllEncrypted]);

  useEffect(() => {
    if (supplyAssetsKey) {
      if (lastFetchedAssetsKeyRef.current !== supplyAssetsKey) {
        lastFetchedAssetsKeyRef.current = supplyAssetsKey;
        fetchAllEncrypted();
      }
    } else {
      setEncrypted({});
      setTotals({});
      lastFetchedAssetsKeyRef.current = '';
    }
  }, [supplyAssetsKey, fetchAllEncrypted]);

  useEffect(() => {
    if (!isLoading && isConnected && Object.keys(encrypted).length > 0) {
      const symbols = Object.keys(encrypted).filter(s => {
        const enc = encrypted[s];
        const t = totals[s];
        const notAuto = !hasAutoDecryptedRef.current[s];
        const needed = (enc.supplied || enc.borrowed) && !t?.isDecrypted && !decryptingRefs.current[s];
        return notAuto && needed;
      });
      if (symbols.length > 0) {
        // Mark to prevent re-scheduling
        symbols.forEach(s => { hasAutoDecryptedRef.current[s] = true; });
        const id = setTimeout(() => {
          symbols.forEach(s => {
            scheduleDecryptTotals(s);
          });
        }, 200);
        return () => clearTimeout(id);
      }
    }
  }, [isLoading, isConnected, encrypted, totals, scheduleDecryptTotals]);

  useEffect(() => {
    if (!isConnected) {
      setEncrypted({});
      setTotals({});
      decryptingRefs.current = {};
      hasAutoDecryptedRef.current = {};
      decryptQueueRef.current = [];
      isProcessingQueueRef.current = false;
      setIsDecryptingTotals(false);
    }
  }, [isConnected]);

  return {
    totals,
    isLoading,
    isDecrypting: isDecryptingTotals,
    decryptTotals,
    decryptAllTotals,
    forceRefresh
  };
}
