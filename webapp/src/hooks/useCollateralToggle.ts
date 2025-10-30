'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useConfig } from 'wagmi';
import { waitForTransactionReceipt, readContract } from '@wagmi/core';
import { CONTRACTS } from '../config/contracts';
import { parseTransactionError } from '../utils/errorHandling';

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
  // Read current collateral status
  const {
    data: isCollateralEnabled,
    isLoading: isLoadingStatus,
    refetch: refetchStatus,
  } = useReadContract({
    address: CONTRACTS.LENDING_POOL as `0x${string}`,
    abi: POOL_ABI,
    functionName: 'userCollateralEnabled',
    args:
      assetAddress && userAddress
        ? ([userAddress, assetAddress] as readonly [`0x${string}`, `0x${string}`])
        : undefined,
    query: {
      enabled: enabled && !!assetAddress && !!userAddress,
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
      setTransactionError(parseTransactionError(writeError));
      // eslint-disable-next-line no-console
      console.error('❌ Collateral toggle write error:', writeError);
    }
  }, [writeError]);

  // Surface receipt/confirmation errors
  useEffect(() => {
    if (confirmError) {
      setTransactionError(parseTransactionError(confirmError));
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

    try {
      setTransactionError(null);
      setIsSuccess(false);

      // eslint-disable-next-line no-console
      console.log(`🔄 Toggling collateral for ${assetAddress}:`, useAsCollateral);

      writeContract({
        address: CONTRACTS.LENDING_POOL as `0x${string}`,
        abi: POOL_ABI,
        functionName: 'setUserUseReserveAsCollateral',
        args: [assetAddress as `0x${string}`, useAsCollateral],
      });
    } catch (error: any) {
      // eslint-disable-next-line no-console
      console.error('❌ Error toggling collateral:', error);
      setTransactionError(parseTransactionError(error));
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
  const config = useConfig();

  const {
    data: hash,
    writeContract,
    writeContractAsync,
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
      setError(new Error(parseTransactionError(writeError)));
    }
  }, [writeError]);

  // Surface receipt errors
  useEffect(() => {
    if (confirmError) {
      setError(new Error(parseTransactionError(confirmError)));
    }
  }, [confirmError]);

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

    setError(null);
    console.log(`🔄 Starting collateral toggle for ${asset.symbol || asset.address}: ${enabled}`);

    const txHash = await writeContractAsync({
      address: CONTRACTS.LENDING_POOL as `0x${string}`,
      abi: POOL_ABI,
      functionName: 'setUserUseReserveAsCollateral',
      args: [asset.address as `0x${string}`, enabled],
    });

    console.log('📤 Transaction submitted, awaiting confirmation:', txHash);
    await waitForTransactionReceipt(config, { hash: txHash });
    console.log('✅ Transaction confirmed successfully');

    try {
      let onchainEnabled: boolean | undefined = undefined;
      try {
        const res = await readContract(config, {
          address: CONTRACTS.LENDING_POOL as `0x${string}`,
          abi: POOL_ABI,
          functionName: 'userCollateralEnabled',
          args: [userAddress as `0x${string}`, asset.address as `0x${string}`],
          blockTag: 'latest',
        });
        onchainEnabled = Boolean(res);
        console.log('🔎 On-chain collateral status after tx:', asset.symbol || asset.address, onchainEnabled);
      } catch (readErr) {
        console.warn('⚠️ Could not read on-chain collateral status:', readErr);
      }

      window.dispatchEvent(
        new CustomEvent('collateralToggled', {
          detail: {
            txHash,
            timestamp: Date.now(),
            assetSymbol: asset.symbol,
            assetAddress: asset.address,
            requestedEnabled: enabled,
            onchainEnabled,
          },
        })
      );
    } catch {
      // ignore SSR
    }
  };

  return {
    toggleCollateral,
    isToggling: isWritePending || isConfirming,
    error,
  };
}
