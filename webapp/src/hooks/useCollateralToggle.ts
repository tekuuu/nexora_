'use client';

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useState, useEffect } from 'react';
import { getSafeContractAddresses } from '../config/contractConfig';

const POOL_ABI = [
  {
    "inputs": [
      { "internalType": "address", "name": "", "type": "address" },
      { "internalType": "address", "name": "", "type": "address" }
    ],
    "name": "userCollateralEnabled",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "asset", "type": "address" },
      { "internalType": "bool", "name": "useAsCollateral", "type": "bool" }
    ],
    "name": "setUserUseReserveAsCollateral",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;

interface UseCollateralToggleProps {
  assetAddress: string | undefined;
  userAddress: string | undefined;
  enabled?: boolean;
}

export function useCollateralToggle({ assetAddress, userAddress, enabled = true }: UseCollateralToggleProps) {
  const CONTRACTS = getSafeContractAddresses();
  
  // Read current collateral status
  const { 
    data: isCollateralEnabled, 
    isLoading: isLoadingStatus,
    refetch: refetchStatus 
  } = useReadContract({
    address: CONTRACTS.POOL_ADDRESS as `0x${string}`,
    abi: POOL_ABI,
    functionName: 'userCollateralEnabled',
    args: assetAddress && userAddress ? [userAddress as `0x${string}`, assetAddress as `0x${string}`] : undefined,
    query: {
      enabled: enabled && !!assetAddress && !!userAddress,
    }
  });

  // Write contract hook for toggling
  const {
    data: hash,
    writeContract,
    isPending: isWritePending,
    error: writeError,
    reset: resetWrite
  } = useWriteContract();

  // Wait for transaction
  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: confirmError
  } = useWaitForTransactionReceipt({
    hash,
    query: {
      enabled: !!hash,
    }
  });

  const [transactionError, setTransactionError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Handle write errors
  useEffect(() => {
    if (writeError) {
      setTransactionError(writeError.message);
      console.error('❌ Collateral toggle write error:', writeError);
      setIsProcessing(false);
    }
  }, [writeError]);

  // Handle confirmation errors
  useEffect(() => {
    if (confirmError) {
      setTransactionError(confirmError.message);
      console.error('❌ Collateral toggle confirmation error:', confirmError);
      setIsProcessing(false);
    }
  }, [confirmError]);

  // Handle success
  useEffect(() => {
    if (isConfirmed && hash) {
      console.log('✅ Collateral toggle confirmed!');
      setIsSuccess(true);
      setTransactionError(null);
      setIsProcessing(false);
      
      // Refetch status after successful toggle
      setTimeout(() => {
        refetchStatus();
      }, 1500);

      // Reset write state and success after delay
      setTimeout(() => {
        setIsSuccess(false);
        resetWrite();
      }, 3000);
    }
  }, [isConfirmed, hash, refetchStatus, resetWrite]);

  // Handle when hash is cleared (transaction rejected or reset)
  useEffect(() => {
    if (!hash && isProcessing) {
      console.log('🔄 Transaction hash cleared, resetting processing state');
      setIsProcessing(false);
    }
  }, [hash, isProcessing]);

  const toggleCollateral = async (useAsCollateral: boolean) => {
    if (!assetAddress) {
      setTransactionError('Asset address not provided');
      return;
    }

    try {
      setTransactionError(null);
      setIsSuccess(false);
      setIsProcessing(true);

      console.log(`🔄 Toggling collateral for ${assetAddress}:`, useAsCollateral);

      writeContract({
        address: CONTRACTS.POOL_ADDRESS as `0x${string}`,
        abi: POOL_ABI,
        functionName: 'setUserUseReserveAsCollateral',
        args: [assetAddress as `0x${string}`, useAsCollateral],
      });
    } catch (error: any) {
      console.error('❌ Error toggling collateral:', error);
      setTransactionError(error.message || 'Failed to toggle collateral');
      setIsProcessing(false);
    }
  };

  return {
    isCollateralEnabled: isCollateralEnabled as boolean | undefined,
    isLoadingStatus,
    toggleCollateral,
    isPending: isProcessing || isWritePending || isConfirming,
    isSuccess,
    transactionError,
    transactionHash: hash,
    refetchStatus
  };
}


