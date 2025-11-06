'use client';
/* eslint-disable react-hooks/exhaustive-deps */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAccount, useReadContract, useWalletClient } from 'wagmi';
import { createPublicClient, http, encodeFunctionData } from 'viem';
import { sepolia } from 'wagmi/chains';
import { getFHEInstance } from '../utils/fhe';
import { FhevmDecryptionSignature } from '../utils/FhevmDecryptionSignature';
import { getSepoliaRpcUrls } from '../utils/rpc';
import { rpcCache, generateCacheKey, CACHE_TTL } from '../utils/rpcCache';

// Generic ABI for confidential token contracts
const CONFIDENTIAL_TOKEN_ABI = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "user",
        "type": "address"
      }
    ],
    "name": "getEncryptedBalance",
    "outputs": [
      {
        "internalType": "euint64",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

interface TokenInfo {
  address: string;
  symbol: string;
  decimals: number;
}

export const useConfidentialTokenBalance = (
  tokenInfo: TokenInfo,
  masterSignature: string | null, 
  getMasterSignature: () => FhevmDecryptionSignature | null
) => {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  
  // Core state - minimal and stable
  const [encryptedBalanceState, setEncryptedBalanceState] = useState<string | null>(null);
  const [confidentialBalance, setConfidentialBalance] = useState<string>('••••••••');
  const [hasConfidentialToken, setHasConfidentialToken] = useState<boolean>(false);
  const [isDecrypting, setIsDecrypting] = useState<boolean>(false);
  const [isDecrypted, setIsDecrypted] = useState<boolean>(false);
  const [isLoadingBalance, setIsLoadingBalance] = useState<boolean>(false);
  const [decryptionError, setDecryptionError] = useState<string | null>(null);

  // Refs for stable references
  const lastEncryptedBalanceRef = useRef<string | null>(null);
  const isDecryptingRef = useRef(false);

  // Read encrypted balance from contract using useReadContract for auto-refresh
  const { data: encryptedBalance, refetch: refetchEncryptedBalance } = useReadContract({
    address: tokenInfo.address as `0x${string}`,
    abi: CONFIDENTIAL_TOKEN_ABI,
    functionName: 'getEncryptedBalance',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!tokenInfo.address && tokenInfo.address !== '0x0000000000000000000000000000000000000000' && typeof window !== 'undefined',
      refetchInterval: false, // DISABLED - only manual refetch to prevent 429 errors
      refetchIntervalInBackground: false,
      staleTime: Infinity, // Keep data until manually invalidated
    },
  });

  // Simple balance fetch function - no dependencies
  const fetchBalance = useCallback(async () => {
    if (!address || !tokenInfo.address) {
      console.warn('Missing address or token address for fetching balance');
      return;
    }

    // Check cache first to reduce API calls
    const cacheKey = generateCacheKey(tokenInfo.address, 'getEncryptedBalance', [address], address);
    const cachedData = rpcCache.get(cacheKey);
    
    if (cachedData) {
      console.log('📦 Using cached encrypted balance data');
      setEncryptedBalanceState(cachedData);
      setIsLoadingBalance(false);
      return;
    }

    try {
      setIsLoadingBalance(true);
      
      // Use your dedicated Infura RPC endpoint
      const rpcUrls = getSepoliaRpcUrls();
      
      let publicClient;
      let lastError;
      
      for (const rpcUrl of rpcUrls) {
        try {
          console.log(`🔄 Trying RPC: ${rpcUrl}`);
          publicClient = createPublicClient({
            chain: sepolia,
            transport: http(rpcUrl),
          });
          
          // Test the connection with a simple call
          await publicClient.getBlockNumber();
          console.log(`✅ Connected to ${rpcUrl}`);
          break; // If successful, use this client
        } catch (error) {
          console.log(`❌ Failed to connect to ${rpcUrl}:`, (error as Error).message);
          lastError = error;
          continue;
        }
      }
      
      if (!publicClient) {
        console.error('❌ All RPC endpoints failed, last error:', lastError);
        throw new Error(`All RPC endpoints failed. Last error: ${lastError instanceof Error ? lastError.message : 'Unknown error'}`);
      }

      // Make raw contract call - with additional safety check
      if (!publicClient || typeof publicClient.call !== 'function') {
        console.error('❌ publicClient is not properly initialized');
        throw new Error('Public client not properly initialized');
      }

      const result = await publicClient.call({
        to: tokenInfo.address as `0x${string}`,
        data: encodeFunctionData({
          abi: CONFIDENTIAL_TOKEN_ABI,
          functionName: 'getEncryptedBalance',
          args: [address as `0x${string}`],
        }),
      });

      if (result.data && result.data !== '0x') {
        const balanceData = result.data as `0x${string}`;
        setEncryptedBalanceState(balanceData);
        
        // Cache the result to reduce future API calls
        rpcCache.set(cacheKey, balanceData, CACHE_TTL.ENCRYPTED_DATA);
        
        // Check if balance changed
        if (balanceData !== lastEncryptedBalanceRef.current) {
          lastEncryptedBalanceRef.current = balanceData;
          
          // Update hasConfidentialToken based on balance
          const isAllZeros = balanceData === '0x0000000000000000000000000000000000000000000000000000000000000000';
          setHasConfidentialToken(!isAllZeros);
          console.log('🔍 Balance check:', { balanceData, isAllZeros, hasConfidentialToken: !isAllZeros });
        }
      } else {
        console.log('🔍 No balance data or empty result:', result.data);
        setEncryptedBalanceState('0x0000000000000000000000000000000000000000000000000000000000000000');
        setHasConfidentialToken(false);
      }
    } catch (error) {
      console.error('Failed to fetch balance:', error);
      setEncryptedBalanceState(null);
      setHasConfidentialToken(false);
    } finally {
      setIsLoadingBalance(false);
    }
  }, [address, tokenInfo.address]);

  // Simple decrypt function - uses master signature
  const decryptBalance = useCallback(async () => {
    if (!isConnected || !address || !encryptedBalanceState || !walletClient || !masterSignature) {
      console.log('Missing requirements for decryption:', {
        isConnected,
        address,
        encryptedBalanceState: !!encryptedBalanceState,
        walletClient: !!walletClient,
        masterSignature: !!masterSignature
      });
      return;
    }

    // Prevent multiple simultaneous decryption attempts
    if (isDecryptingRef.current) {
      console.log('🔒 Confidential token decryption already in progress, skipping...');
      return;
    }

    isDecryptingRef.current = true;
    setIsDecrypting(true);
    
    try {
      // Get the master signature object
      const masterSig = getMasterSignature();
      if (!masterSig) {
        throw new Error('Master signature not available');
      }

      // Check if the master signature is authorized for the current contract address
      console.log('🔍 Debug authorization check:', {
        currentTokenAddress: tokenInfo.address,
        authorizedAddresses: masterSig.contractAddresses,
        authorizedAddressesLength: masterSig.contractAddresses.length,
        isAuthorized: masterSig.contractAddresses.includes(tokenInfo.address as `0x${string}`),
        contractAddressesType: typeof masterSig.contractAddresses,
        contractAddressesContent: JSON.stringify(masterSig.contractAddresses)
      });
      
      if (!tokenInfo.address || !masterSig.contractAddresses.includes(tokenInfo.address as `0x${string}`)) {
        console.warn('⚠️ Master signature not authorized for current contract address in useConfidentialTokenBalance.', {
          currentTokenAddress: tokenInfo.address,
          authorizedAddresses: masterSig.contractAddresses,
          isAuthorized: masterSig.contractAddresses.includes(tokenInfo.address as `0x${string}`)
        });
        
        // For new contract addresses, try to decrypt anyway if we have a valid signature
        // This handles cases where contracts are redeployed but the signature is still valid
        console.log('🔄 Attempting decryption with current signature for new contract address...');
        
        // Also try to clear and recreate the signature if authorization fails
        console.log('🔄 Authorization failed - attempting to clear cache and retry...');
        // Clear all FHEVM-related localStorage to force fresh signature
        if (typeof window !== 'undefined') {
          const keysToRemove: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (
              key.includes('fhevm') || 
              key.includes('decryption') || 
              key.includes('signature') ||
              key.includes('encrypted') ||
              key.includes('FhevmDecryptionSignature')
            )) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach(key => localStorage.removeItem(key));
          console.log(`🧹 Cleared ${keysToRemove.length} FHEVM-related localStorage items due to authorization failure`);
        }
        
        // Don't clear the signature - just try to use it
        // If it fails, the decryption will fail gracefully
      }

      // Additional check: verify the contract addresses are valid
      if (!masterSig.contractAddresses || masterSig.contractAddresses.length === 0) {
        console.warn('⚠️ Master signature has no contract addresses in useConfidentialTokenBalance. Clearing cache.');
        localStorage.removeItem(`fhe_master_decryption_${address}`);
        setDecryptionError('Invalid decryption signature. Please re-authorize.');
        setIsDecrypting(false);
        return;
      }

      // Get FHE instance
      const fheInstance = await getFHEInstance();
      
      // Decrypt balance using master signature
      if (!encryptedBalanceState) {
        console.log('No encrypted balance data to decrypt');
        return;
      }
      
      let result;
      try {
        result = await fheInstance.userDecrypt(
          [{ handle: encryptedBalanceState, contractAddress: tokenInfo.address as `0x${string}` }],
          masterSig.privateKey,
          masterSig.publicKey,
          masterSig.signature,
          masterSig.contractAddresses,
          masterSig.userAddress,
          masterSig.startTimestamp,
          masterSig.durationDays
        );
      } catch (decryptError: any) {
        // Handle authorization errors specifically
        if (decryptError.message && decryptError.message.includes('not authorized')) {
          console.warn('🚫 Authorization error during decryption in useConfidentialTokenBalance. Clearing cache and requesting re-authorization.', {
            error: decryptError.message,
            currentTokenAddress: tokenInfo.address,
            authorizedAddresses: masterSig.contractAddresses
          });
          
          // Clear the old signature from localStorage
          localStorage.removeItem(`fhe_master_decryption_${address}`);
          
          // Clear the current signature state
          setDecryptionError('Authorization expired. Please re-authorize decryption.');
          setIsDecrypting(false);
          return;
        }
        
        // Re-throw other decryption errors
        throw decryptError;
      }

      const decryptedValue = result[encryptedBalanceState];
      if (decryptedValue !== undefined) {
        const decimals = typeof tokenInfo.decimals === 'number' ? tokenInfo.decimals : 6;
        let tokenValue: number;
        if (typeof decryptedValue === 'bigint') {
          tokenValue = Number(decryptedValue) / Math.pow(10, decimals);
        } else if (typeof decryptedValue === 'string') {
          tokenValue = Number(BigInt(decryptedValue)) / Math.pow(10, decimals);
        } else {
          tokenValue = 0;
        }
        
        const suffix = tokenInfo.symbol && tokenInfo.symbol.startsWith('c')
          ? tokenInfo.symbol
          : `c${tokenInfo.symbol}`;
  const formattedBalance = `${tokenValue.toFixed(8)} ${suffix}`;
  // Do not log decrypted confidential balances to console; update UI only
        setConfidentialBalance(formattedBalance);
        setHasConfidentialToken(tokenValue > 0);
        setIsDecrypted(true);
        
        // Store the successfully decrypted balance to prevent it from reverting to dots
        lastEncryptedBalanceRef.current = encryptedBalanceState;
        // Balance decrypted successfully
      }
    } catch (error) {
      console.error('Confidential token decryption failed:', error);
      setConfidentialBalance('••••••••');
    } finally {
      setIsDecrypting(false);
      isDecryptingRef.current = false;
    }
  }, [isConnected, address, encryptedBalanceState, walletClient, masterSignature, getMasterSignature, tokenInfo]);

  // Handle encrypted balance from useReadContract
  useEffect(() => {
    if (encryptedBalance) {
      // Handle different return types from contract call
      let balanceData: string | null = null;
      
      if (typeof encryptedBalance === 'string') {
        balanceData = encryptedBalance;
      } else if (typeof encryptedBalance === 'object' && encryptedBalance !== null) {
        // If it's an object, try to extract the data
        balanceData = (encryptedBalance as any).data || (encryptedBalance as any).result || null;
      }
      
      console.log('🔍 useConfidentialTokenBalance: encryptedBalance received:', balanceData, 'type:', typeof balanceData);
      console.log('🔍 Balance data details:', {
        hasData: !!balanceData,
        isString: typeof balanceData === 'string',
        notEmpty: balanceData !== '0x',
        notZero: balanceData !== '0x0000000000000000000000000000000000000000000000000000000000000000',
        hasLength: (balanceData?.length || 0) > 2,
        length: balanceData?.length
      });
      
      // Check if we have valid encrypted balance data
      const hasEncryptedBalance = Boolean(
        balanceData && 
        typeof balanceData === 'string' && 
        balanceData !== '0x' && 
        balanceData !== '0x0000000000000000000000000000000000000000000000000000000000000000' &&
        (balanceData?.length || 0) > 2
      );
      
      // Check if this is a new balance (different from what we had before)
      const isNewBalance = lastEncryptedBalanceRef.current !== balanceData;
      
      if (isNewBalance) {
        setHasConfidentialToken(hasEncryptedBalance);
        setEncryptedBalanceState(balanceData);
        lastEncryptedBalanceRef.current = balanceData;
        
        console.log('🔍 Final state update:', {
          hasEncryptedBalance,
          balanceData: balanceData ? balanceData.substring(0, 20) + '...' : 'null',
          tokenSymbol: tokenInfo.symbol
        });
        
        if (!hasEncryptedBalance) {
          setConfidentialBalance('••••••••');
          console.log(`🔍 ${tokenInfo.symbol}: No encrypted balance found, setting to dots`);
          // No balance found
        } else {
          setConfidentialBalance('••••••••');
          console.log(`🔍 ${tokenInfo.symbol}: Encrypted balance found, will decrypt if master signature available`);
          
          // If we have a master signature and the balance has changed, decrypt
          if (masterSignature && !isDecrypting) {
            console.log('🔄 Encrypted balance detected with master signature - immediately decrypting...');
            // Small delay to ensure state is updated
            setTimeout(() => {
              if (!isDecryptingRef.current) {
                decryptBalance();
              }
            }, 100);
          }
          // Balance found
        }
      } else {
        console.log(`🔍 ${tokenInfo.symbol}: Balance unchanged, skipping update`);
      }
    } else {
      // No encrypted balance data
      setHasConfidentialToken(false);
      setEncryptedBalanceState(null);
      setConfidentialBalance('••••••••');
    }
  }, [encryptedBalance]);

  // Initialize when address changes
  useEffect(() => {
    if (address && isConnected) {
      // Address connected, useReadContract will handle fetching
      // If we already have a master signature, we'll auto-decrypt when balance data arrives
      console.log('🔄 Address connected, waiting for encrypted balance data...');
    } else {
      setEncryptedBalanceState(null);
      setConfidentialBalance('••••••••');
      setHasConfidentialToken(false);
      setIsDecrypted(false);
    }
  }, [address, isConnected]);

  // Smart auto-decrypt effect - ONLY decrypt once when master signature is available
  // After that, only decrypt on manual forceRefresh() calls (triggered by transactions)
  const hasAutoDecryptedRef = useRef(false);
  
  useEffect(() => {
    // Only auto-decrypt ONCE when we first get a master signature
    // Subsequent updates should be triggered manually via forceRefresh() after transactions
    if (
      masterSignature && 
      encryptedBalanceState && 
      !isLoadingBalance && 
      !isDecrypting && 
      !isDecryptingRef.current &&
      !hasAutoDecryptedRef.current && // Only if we haven't auto-decrypted yet
      !isDecrypted // And not already decrypted
    ) {
      console.log('🔄 Initial auto-decryption after master signature...');
      hasAutoDecryptedRef.current = true; // Mark as auto-decrypted
      
      // Decrypt after a short delay to avoid race conditions
      const timeoutId = setTimeout(() => {
        if (!isDecryptingRef.current) {
          decryptBalance();
        }
      }, 200);
      
      return () => clearTimeout(timeoutId);
    } else if (!masterSignature && isDecrypted) {
      // Reset auto-decrypt flag when signature is lost
      hasAutoDecryptedRef.current = false;
      lockBalance();
    }
  }, [masterSignature, encryptedBalanceState, isLoadingBalance, isDecrypted]); // Minimal deps to prevent loops

  // Smart refresh function - fetches new balance and triggers decryption
  const forceRefresh = useCallback(async () => {
    console.log('🔄 Force refreshing confidential balance after transaction...');
    
    // Fetch the latest balance from blockchain
    await fetchBalance();
    
    // If we have a master signature, decrypt the new balance
    if (masterSignature && !isDecryptingRef.current) {
      console.log('🔓 Auto-decrypting new balance after refresh...');
      // Small delay to ensure balance is fetched
      setTimeout(() => {
        if (!isDecryptingRef.current) {
          decryptBalance();
        }
      }, 500);
    }
  }, [fetchBalance, masterSignature, decryptBalance]);

  // Simple lock function - only lock when there's truly no master signature
  const lockBalance = useCallback(() => {
    if (!masterSignature) {
      console.log('🔒 Locking confidential balance - no master signature available');
      setIsDecrypted(false);
      setConfidentialBalance('••••••••');
    }
  }, [masterSignature]);

  const canDecrypt = !!encryptedBalance && encryptedBalance !== '0x0000000000000000000000000000000000000000000000000000000000000000' && !!masterSignature;
  
  // Cleanup cache periodically to prevent memory leaks
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      rpcCache.cleanup();
    }, 60000); // Clean every minute

    return () => clearInterval(cleanupInterval);
  }, []);

  return {
    formattedBalance: confidentialBalance,
    refetchConfidentialBalance: refetchEncryptedBalance,
    hasConfidentialToken,
    canDecrypt,
    decryptBalance,
    isDecrypting,
    isLoadingBalance,
    isDecrypted,
    isUpdating: isDecrypting || isLoadingBalance,
    lockBalance,
    forceRefresh: refetchEncryptedBalance,
    decryptionError,
  };
};
