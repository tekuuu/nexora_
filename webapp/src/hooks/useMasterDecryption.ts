'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { getFHEInstance } from '../utils/fhe';
import { FhevmDecryptionSignature } from '../utils/FhevmDecryptionSignature';
import { ethers } from 'ethers';
import { getSafeContractAddresses } from '../config/contractConfig';
import { CONTRACTS } from '../config/contracts';

  // Master decryption contract addresses

export const useMasterDecryption = () => {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  
  // Master decryption state
  const [isAllDecrypted, setIsAllDecrypted] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [masterSignature, setMasterSignature] = useState<string | null>(null);
  const [decryptionError, setDecryptionError] = useState<string | null>(null);
  
  // Get contract addresses with validation
  const contractAddresses = getSafeContractAddresses();
  
  // Ref to store the actual FhevmDecryptionSignature object for reuse
  const masterSignatureRef = useRef<FhevmDecryptionSignature | null>(null);
  const isUnlockingRef = useRef(false);

  // Clear corrupted signatures on mount (do NOT clear the simple signature key)
  useEffect(() => {
    if (address && typeof window !== 'undefined') {
      // Clear any corrupted signatures
      try {
        // Check for corrupted FhevmDecryptionSignature entries
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.includes(address) && (key.includes('fhevm-decryption-signature') || key.includes('FhevmDecryptionSignature'))) {
            try {
              const value = localStorage.getItem(key);
              if (value) {
                JSON.parse(value);
              }
            } catch (error) {
              console.log('🧹 Clearing corrupted signature:', key);
              localStorage.removeItem(key);
            }
          }
        }
      } catch (error) {
        console.log('Error cleaning corrupted signatures:', error);
      }
    }
  }, [address]);

  // Clear decryption state on disconnect or contract address change
  useEffect(() => {
    if (!isConnected && address) {
      localStorage.removeItem(`fhe_master_decryption_${address}`);
      setMasterSignature(null);
      setIsAllDecrypted(false);
      setIsDecrypting(false);
      setDecryptionError(null);
      masterSignatureRef.current = null;
      isUnlockingRef.current = false;
    }
  }, [isConnected, address]);

  // Clear decryption state when contract addresses change (no JSON parsing on hex-only storage)
  useEffect(() => {
    if (!address || !contractAddresses) return;

    // Compare expected address set vs the currently loaded signature object
    const sigObj = masterSignatureRef.current;

    const poolAddr = contractAddresses.POOL_ADDRESS || CONTRACTS.LENDING_POOL;
    const cwethAddr = contractAddresses.CWETH_ADDRESS || CONTRACTS.CONFIDENTIAL_WETH;

    const expected = [
      cwethAddr,
      CONTRACTS.CONFIDENTIAL_USDC,
      CONTRACTS.CONFIDENTIAL_DAI,
      CONTRACTS.TOKEN_SWAPPER,
      poolAddr,
    ]
      .filter((a) => !!a)
      .map((a) => a.toLowerCase())
      .sort();

    const actual = (sigObj?.contractAddresses || [])
      .map((a: string) => a.toLowerCase())
      .sort();

    if (expected.length > 0 && JSON.stringify(actual) !== JSON.stringify(expected)) {
      console.log('🔄 Contract addresses changed, will create new signature on next unlock');
      setMasterSignature(null);
      setIsAllDecrypted(false);
      setIsDecrypting(false);
      setDecryptionError(null);
      masterSignatureRef.current = null;
      isUnlockingRef.current = false;
    }
  }, [address, contractAddresses]);
  // Build dynamic address set from validated addresses to avoid mismatches with Pool address
  const POOL_ADDR = contractAddresses?.POOL_ADDRESS || CONTRACTS.LENDING_POOL;
  const CWETH_ADDR = contractAddresses?.CWETH_ADDRESS || CONTRACTS.CONFIDENTIAL_WETH;

  const CONTRACT_ADDRESSES = [
    CWETH_ADDR,                         // cWETH
    CONTRACTS.CONFIDENTIAL_USDC,        // cUSDC
    CONTRACTS.CONFIDENTIAL_DAI,         // cDAI
    CONTRACTS.TOKEN_SWAPPER,            // Swapper
    POOL_ADDR,                          // Pool (critical for reserve totals and user balances)
  ].filter((addr) => addr && typeof addr === 'string'); // Filter out undefined/null

  // Master unlock function - now prevents multiple simultaneous calls
  const unlockAllBalances = useCallback(async () => {
    if (!isConnected || !address || !CONTRACT_ADDRESSES.length || !walletClient) {
      console.log('Missing requirements for master decryption:', { 
        isConnected, 
        address, 
        contractAddresses: CONTRACT_ADDRESSES.length,
        walletClient: !!walletClient
      });
      return;
    }

    // Do not aggressively clear storage; preserve existing valid signatures

    // Prevent multiple simultaneous unlock attempts
    if (isUnlockingRef.current || isDecrypting) {
      console.log('🔒 Unlock already in progress, skipping...');
      return;
    }

    isUnlockingRef.current = true;
    setIsDecrypting(true);
    setDecryptionError(null);
    
    try {
      console.log('🔓 Starting master decryption process...');
      
      // Get FHE instance
      const fheInstance = await getFHEInstance();
      console.log('✅ FHE instance created');
      
      // Create signer from injected EIP-1193 provider only (MetaMask, injected)
      if (typeof window === 'undefined' || !(window as any).ethereum) {
        setDecryptionError('Wallet provider unavailable for EIP-712 signing. Please use an injected wallet (e.g., MetaMask).');
        setIsDecrypting(false);
        isUnlockingRef.current = false;
        return;
      }
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      
      let sig = masterSignatureRef.current;
      
      // Check if we need to create a new signature (no signature OR contract addresses changed)
      const needsNewSignature = !sig || !sig.contractAddresses || 
        JSON.stringify(sig.contractAddresses.sort()) !== JSON.stringify(CONTRACT_ADDRESSES.sort());
      
      if (needsNewSignature) {
        if (sig && sig.contractAddresses) {
          console.log('🔄 Contract addresses changed, creating new signature...');
          console.log('Old addresses:', sig.contractAddresses.sort());
          console.log('New addresses:', CONTRACT_ADDRESSES.sort());
        } else {
          console.log('🔐 Creating master decryption signature...');
        }
        
        // Clear old signature from localStorage if it exists
        if (sig) {
          localStorage.removeItem(`fhe_master_decryption_${address}`);
        }
        
        // Use FhevmDecryptionSignature to create proper signature with current addresses
        console.log('🔐 Creating master signature with addresses:', CONTRACT_ADDRESSES);
        console.log('🔍 Address breakdown for signature:', {
          cweth: CONTRACTS.CONFIDENTIAL_WETH,
          cusdc: CONTRACTS.CONFIDENTIAL_USDC,
          swapper: CONTRACTS.TOKEN_SWAPPER,
          lendingPool: CONTRACTS.LENDING_POOL, // 🆕 NEW
          finalAddresses: CONTRACT_ADDRESSES
        });
        
        sig = await FhevmDecryptionSignature.loadOrSign(
          fheInstance as any,
          CONTRACT_ADDRESSES,
          signer
        );

        if (!sig) {
          throw new Error('Failed to create master decryption signature');
        }

        console.log('✅ Master decryption signature created');
        console.log('🔍 Master signature details:', {
          userAddress: sig.userAddress,
          contractAddresses: sig.contractAddresses,
          isValid: sig.isValid(),
          signature: sig.signature.substring(0, 10) + '...'
        });
        console.log('🔍 Full contract addresses for signature:', sig.contractAddresses);
        console.log('🔍 Expected addresses:', CONTRACT_ADDRESSES);
        console.log('🔍 Address comparison:', {
          signatureAddresses: sig.contractAddresses.sort(),
          expectedAddresses: CONTRACT_ADDRESSES.sort(),
          match: JSON.stringify(sig.contractAddresses.sort()) === JSON.stringify(CONTRACT_ADDRESSES.sort())
        });
        console.log('🔍 Detailed address breakdown:', {
          contractAddressesCWETH: contractAddresses?.CWETH_ADDRESS,
          contractAddressesPOOL: contractAddresses?.POOL_ADDRESS,
          contractsTokenSwapper: CONTRACTS.TOKEN_SWAPPER,
          contractsConfidentialUSDC: CONTRACTS.CONFIDENTIAL_USDC,
          contractsConfidentialWETH: CONTRACTS.CONFIDENTIAL_WETH
        });
        masterSignatureRef.current = sig;
        
        // Store the full signature object in localStorage using FhevmDecryptionSignature's method
        await sig.saveToLocalStorage(fheInstance as any);
      } else {
        console.log('✅ Using existing master decryption signature with matching contract addresses');
      }

      // Also store the signature string for quick access
      if (sig) {
        localStorage.setItem(`fhe_master_decryption_${address}`, sig.signature);
        setMasterSignature(sig.signature);
      }
      setIsAllDecrypted(true);
      console.log('✅ Master decryption successful - all balances unlocked');
      
    } catch (error) {
      console.error('❌ Master decryption failed:', error);
      setDecryptionError(error instanceof Error ? error.message : 'Decryption failed');
      setIsAllDecrypted(false);
    } finally {
      setIsDecrypting(false);
      isUnlockingRef.current = false;
    }
  }, [isConnected, address, walletClient, isDecrypting]);

  // Load stored signature on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && address) {
      const storedSignature = localStorage.getItem(`fhe_master_decryption_${address}`);
      if (storedSignature) {
        console.log('🔄 Found stored signature, loading FhevmDecryptionSignature object...');
        
        // We need to reconstruct the FhevmDecryptionSignature object from localStorage
        // The FhevmDecryptionSignature class stores the full object in localStorage
        const loadStoredSignatureObject = async () => {
          try {
            const fheInstance = await getFHEInstance();
            
            // Try to load the full signature object from localStorage
            const sig = await FhevmDecryptionSignature.loadFromLocalStorage(
              fheInstance as any,
              CONTRACT_ADDRESSES,
              address
            );
            
            if (sig && sig.isValid()) {
              masterSignatureRef.current = sig;
              setMasterSignature(sig.signature);
              setIsAllDecrypted(true);
              console.log('✅ Successfully loaded stored master signature object');
            } else {
              console.log('❌ Stored signature is invalid or expired, clearing...');
              localStorage.removeItem(`fhe_master_decryption_${address}`);
            }
          } catch (error) {
            console.error('❌ Failed to load stored signature object:', error);
            localStorage.removeItem(`fhe_master_decryption_${address}`);
          }
        };
        
        loadStoredSignatureObject();
      }
    }
  }, [address, walletClient]);

  // Master lock function
  const lockAllBalances = useCallback(() => {
    if (address) {
      // Clear our custom localStorage entry
      localStorage.removeItem(`fhe_master_decryption_${address}`);
      
      // Clear all localStorage entries that might contain FhevmDecryptionSignature data
      // This is a bit aggressive but ensures clean state
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes(address)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      setMasterSignature(null);
      setIsAllDecrypted(false);
      setDecryptionError(null);
      masterSignatureRef.current = null;
      isUnlockingRef.current = false;
      console.log('🔒 All balances locked');
    }
  }, [address]);

  // Clear decryption error
  const clearError = useCallback(() => {
    setDecryptionError(null);
  }, []);

  // Get the master signature object for decryption
  const getMasterSignature = useCallback(() => {
    return masterSignatureRef.current;
  }, []);

  return {
    // State
    isAllDecrypted,
    isDecrypting,
    masterSignature,
    decryptionError,
    contractAddresses: CONTRACT_ADDRESSES,
    
    // Actions
    unlockAllBalances,
    lockAllBalances,
    clearError,
    getMasterSignature,
    
    // Computed
    canDecrypt: CONTRACT_ADDRESSES.length > 0 && isConnected && !!address,
  };
};
