'use client';

import { useCallback } from 'react';
import { useWalletBalances } from './useWalletBalances';
import { useSuppliedBalances } from './useSuppliedBalances';
import { FhevmDecryptionSignature } from '../utils/FhevmDecryptionSignature';

/**
 * Master hook that combines all balance hooks and provides
 * smart invalidation based on transaction types
 * 
 * This is the main hook to use in Dashboard!
 */
export function useSmartBalances(
  masterSignature: string | null,
  getMasterSignature: () => FhevmDecryptionSignature | null
) {
  const walletBalances = useWalletBalances(masterSignature, getMasterSignature);
  const suppliedBalances = useSuppliedBalances(masterSignature, getMasterSignature);

  /**
   * Smart refresh based on transaction type
   * Call this after successful transactions
   */
  const refreshAfterTransaction = useCallback(async (
    transactionType: 'swap' | 'supply' | 'withdraw' | 'borrow' | 'repay',
    tokenSymbol?: string
  ) => {
    console.log(`🔄 Smart refresh: ${transactionType}${tokenSymbol ? ` ${tokenSymbol}` : ''}`);

    switch (transactionType) {
      case 'swap':
        // Swap ETH → cWETH: refresh wallet balances
        console.log(`  ✅ Refreshing wallet balances`);
        await walletBalances.refetch();
        break;

      case 'supply':
        // Supply cUSDC: refresh wallet + supplied
        console.log(`  ✅ Refreshing wallet + supplied balances`);
        await Promise.all([
          walletBalances.refetch(),
          suppliedBalances.forceRefresh()
        ]);
        break;

      case 'withdraw':
        // Withdraw cWETH: refresh wallet + supplied
        console.log(`  ✅ Refreshing wallet + supplied balances`);
        await Promise.all([
          walletBalances.refetch(),
          suppliedBalances.forceRefresh()
        ]);
        break;

      case 'borrow':
        // Borrow cDAI: refresh wallet (received tokens)
        console.log(`  ✅ Refreshing wallet balances (borrowed tokens added)`);
        await walletBalances.refetch();
        // TODO: Add borrowed balances hook
        break;

      case 'repay':
        // Repay cUSDC: refresh wallet (tokens sent)
        console.log(`  ✅ Refreshing wallet balances`);
        await walletBalances.refetch();
        // TODO: Add borrowed balances hook
        break;
    }

    console.log(`✅ Balances refreshed after ${transactionType}`);
  }, [walletBalances, suppliedBalances]);

  /**
   * Refresh all balances manually
   * Fetches encrypted values and auto-decrypts if master signature is available
   */
  const refreshAllBalances = useCallback(async () => {
    console.log('🔄 Refreshing all balances...');
    await Promise.all([
      walletBalances.refetch(),
      suppliedBalances.forceRefresh()
    ]);
    console.log('✅ All balances refreshed');
  }, [walletBalances, suppliedBalances]);

  /**
   * Clear all balance caches
   * Call when wallet disconnects
   */
  const clearAllCaches = useCallback(() => {
    console.log('🗑️ Clearing all balance caches');
    walletBalances.clearCache();
    // SuppliedBalances auto-clears on disconnect
  }, [walletBalances]);

  return {
    // Wallet balances (for Supply tab)
    walletBalances: walletBalances.balances,
    isLoadingWallet: walletBalances.isLoading,
    decryptWalletBalance: walletBalances.decryptBalance,
    decryptAllWalletBalances: walletBalances.decryptAllBalances,
    
    // Supplied balances (for Withdraw/Positions tab)
    suppliedBalances: suppliedBalances.balances,
    isLoadingSupplied: suppliedBalances.isLoading,
    decryptSuppliedBalance: suppliedBalances.decryptBalance,
    decryptAllSuppliedBalances: suppliedBalances.decryptAllBalances,
    
    // Utilities
    getWalletBalance: walletBalances.getBalance,
    getSuppliedBalance: suppliedBalances.getSupplied,
    
    // Smart refresh and cache management
    refreshAfterTransaction,
    refreshAllBalances,
    clearAllCaches,
    
    // Direct access to sub-hooks if needed
    _walletBalances: walletBalances,
    _suppliedBalances: suppliedBalances
  };
}

/**
 * Helper type for transaction handlers
 */
export type TransactionType = 'swap' | 'supply' | 'withdraw' | 'borrow' | 'repay';

