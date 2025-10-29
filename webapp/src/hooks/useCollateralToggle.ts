"use client";

import { useCallback, useEffect, useState } from 'react';
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { CONTRACTS } from '../config/contracts';
import { POOL_ABI } from '../config/poolABI';

/**
 * Client-side hook to toggle an asset's collateral flag for the connected user.
 * 'use client' must be the very first statement in this file.
 */
export default function useCollateralToggle() {
  const { address } = useAccount();
  const [error, setError] = useState<Error | null>(null);

  // Wagmi provides `data` from the write hook which is the transaction hash or undefined.
  const { writeContract, isError, error: writeError, data } = useWriteContract();

  // Use the writeContract's `data` directly as the tx hash for waiting on receipt.
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: (data as `0x${string}`) || undefined });

  const isToggling = Boolean(data) || isConfirming;

  // Do NOT await writeContract; call it and rely on the hook's `data` to populate the tx hash.
  const toggleCollateral = useCallback(
    (asset: { address: string; symbol: string }, enabled: boolean) => {
      if (!address) throw new Error('Wallet not connected');
      setError(null);

      try {
        (writeContract as any)({
          address: CONTRACTS.LENDING_POOL as `0x${string}`,
          abi: POOL_ABI as any,
          functionName: 'setUserUseReserveAsCollateral',
          args: [asset.address as `0x${string}`, enabled],
        } as any);
        // Do not await; `data` will update when wagmi receives the transaction hash
      } catch (err: any) {
        if (err && typeof err === 'object' && 'code' in err && (err as any).code === 4001) {
          setError(new Error('Transaction cancelled by user'));
          return;
        }
        setError(err instanceof Error ? err : new Error('Unknown error'));
        throw err;
      }
    },
    [address, writeContract]
  );

  useEffect(() => {
    if (isError && writeError) {
      setError(writeError instanceof Error ? writeError : new Error(String(writeError)));
    }
  }, [isError, writeError]);

  return { toggleCollateral, isToggling, txHash: data as `0x${string}` | undefined, error, isSuccess };
}
