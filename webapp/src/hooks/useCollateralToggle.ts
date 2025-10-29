'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { getSafeContractAddresses } from '../config/contractConfig';

const POOL_ABI = [
  {
    inputs: [
      { internalType: 'address', name: '', type: 'address' },
      { internalType: 'address', name: '', type: 'address' },
    ],
    name: 'userCollateralEnabled',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'asset', type: 'address' },
      { internalType: 'bool', name: 'useAsCollateral', type: 'bool' },
    ],
    name: 'setUserUseReserveAsCollateral',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

export interface UseCollateralToggleProps {
  assetAddress?: string;
  userAddress?: string;
  enabled?: boolean;
}

/**
 * Asset-scoped hook that reads current collateral status and toggles it for the provided asset/user.
 * Use when you know the concrete asset and user addresses.
 */
export function useAssetCollateralToggle({
  assetAddress,
  userAddress,
  enabled = true,
}: UseCollateralToggleProps) {
  const CONTRACTS = getSafeContractAddresses();
  const poolAddress = CONTRACTS?.POOL_ADDRESS as `0x${string}` | undefined;

  // Read current collateral status
  const {
    data: isCollateralEnabled,
    isLoading: isLoadingStatus,
    refetch: refetchStatus,
  } = useReadContract({
    address: poolAddress as `0x${string}`,
    abi: POOL_ABI,
    functionName: 'userCollateralEnabled',
    args:
      assetAddress && userAddress
        ? ([userAddress, assetAddress] as readonly [`0x${string}`, `0x${string}`])
        : undefined,
    query: {
      enabled: enabled && !!assetAddress && !!userAddress && !!poolAddress,
      staleTime: 0, // Always fetch fresh data
      refetchOnMount: true, // Refetch on component mount
    },
  });

  // Write + confirm
  const {
    data: hash,
    writeContract,
    isPending: isWritePending,
    error: writeError,
  } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: confirmError,
  } = useWaitForTransactionReceipt({
    hash,
  });

  const [transactionError, setTransactionError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Surface write errors
  useEffect(() => {
    if (writeError) {
      setTransactionError(writeError.message);
      // eslint-disable-next-line no-console
      console.error('❌ Collateral toggle write error:', writeError);
    }
  }, [writeError]);

  // Surface receipt/confirmation errors
  useEffect(() => {
    if (confirmError) {
      setTransactionError(confirmError.message);
    }
  }, [confirmError]);

  // On success, refresh the status and briefly expose success state
  useEffect(() => {
    if (isConfirmed) {
      // eslint-disable-next-line no-console
      console.log('✅ Collateral toggle confirmed!');
      setIsSuccess(true);
      setTransactionError(null);

      setTimeout(() => {
        refetchStatus();
      }, 1000);

      setTimeout(() => {
        setIsSuccess(false);
      }, 3000);
    }
  }, [isConfirmed, refetchStatus]);

  const toggleCollateral = async (useAsCollateral: boolean) => {
    if (!assetAddress) {
      setTransactionError('Asset address not provided');
      return;
    }
    if (!poolAddress) {
      setTransactionError('Pool address not configured');
      return;
    }

    try {
      setTransactionError(null);
      setIsSuccess(false);

      // eslint-disable-next-line no-console
      console.log(`🔄 Toggling collateral for ${assetAddress}:`, useAsCollateral);

      writeContract({
        address: poolAddress,
        abi: POOL_ABI,
        functionName: 'setUserUseReserveAsCollateral',
        args: [assetAddress as `0x${string}`, useAsCollateral],
      });
    } catch (error: any) {
      // eslint-disable-next-line no-console
      console.error('❌ Error toggling collateral:', error);
      setTransactionError(error?.message || 'Failed to toggle collateral');
    }
  };

  return {
    isCollateralEnabled: isCollateralEnabled as boolean | undefined,
    isLoadingStatus,
    toggleCollateral,
    isPending: isWritePending || isConfirming,
    isSuccess,
    transactionError,
    transactionHash: hash,
    refetchStatus,
  };
}

/**
 * Backward-compatible default hook used by Dashboard.tsx
 * Exposes a chain-writing toggle function for an arbitrary asset, and unified pending/error states.
 * Usage:
 *   const { toggleCollateral, isToggling, error } = useCollateralToggle();
 *   await toggleCollateral({ address: '0x...' }, true|false)
 */
export default function useCollateralToggle() {
  const { address: userAddress } = useAccount();
  const CONTRACTS = getSafeContractAddresses();
  const poolAddress = CONTRACTS?.POOL_ADDRESS as `0x${string}` | undefined;

  const {
    data: hash,
    writeContract,
    isPending: isWritePending,
    error: writeError,
  } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess,
    error: confirmError,
  } = useWaitForTransactionReceipt({ hash });

  const [error, setError] = useState<Error | null>(null);

  // Surface write errors
  useEffect(() => {
    if (writeError) {
      setError(writeError instanceof Error ? writeError : new Error(String(writeError)));
    }
  }, [writeError]);

  // Surface receipt errors
  useEffect(() => {
    if (confirmError) {
      setError(confirmError instanceof Error ? confirmError : new Error(String(confirmError)));
    }
  }, [confirmError]);

  // Emit an event for listeners (e.g., Dashboard) after success
  useEffect(() => {
    if (isSuccess && hash) {
      try {
        window.dispatchEvent(
          new CustomEvent('collateralToggled', {
            detail: { txHash: hash, timestamp: Date.now() },
          })
        );
      } catch {
        // ignore SSR
      }
    }
  }, [isSuccess, hash]);

  const toggleCollateral = async (
    asset: { address: string; symbol?: string },
    enabled: boolean
  ) => {
    if (!asset?.address) {
      const err = new Error('Asset address not provided');
      setError(err);
      throw err;
    }
    if (!userAddress) {
      const err = new Error('Wallet not connected');
      setError(err);
      throw err;
    }
    if (!poolAddress) {
      const err = new Error('Pool address not configured');
      setError(err);
      throw err;
    }

    setError(null);

    writeContract({
      address: poolAddress,
      abi: POOL_ABI,
      functionName: 'setUserUseReserveAsCollateral',
      args: [asset.address as `0x${string}`, enabled],
    });
  };

  return {
    toggleCollateral,
    isToggling: isWritePending || isConfirming,
    error,
  };
}
