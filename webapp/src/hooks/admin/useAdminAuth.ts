/**
 * Admin Authentication Hook
 * Checks if connected wallet has POOL_ADMIN role
 */

import { useEffect, useState } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { ACL_MANAGER_ABI, ADMIN_CONTRACTS } from '@/config/admin/adminContracts';
import { isAdminWallet } from '@/config/admin/adminConfig';

interface UseAdminAuthReturn {
  isAdmin: boolean;
  isChecking: boolean;
  hasPoolAdminRole: boolean;
  address: string | undefined;
  isConnected: boolean;
}

export function useAdminAuth(): UseAdminAuthReturn {
  const { address, isConnected } = useAccount();
  const [isChecking, setIsChecking] = useState(true);

  // Check if address is in the admin whitelist
  const isWhitelisted = isAdminWallet(address);

  // If not connected or not whitelisted, skip contract checks
  useEffect(() => {
    if (!isConnected || !address || !isWhitelisted) {
      setIsChecking(false);
    }
  }, [isConnected, address, isWhitelisted]);

  // Read POOL_ADMIN role hash
  const { data: poolAdminRole } = useReadContract({
    address: ADMIN_CONTRACTS.ACL_MANAGER as `0x${string}`,
    abi: ACL_MANAGER_ABI,
    functionName: 'POOL_ADMIN',
    query: {
      enabled: isConnected && !!address && isWhitelisted,
    },
  });

  // Check if connected address has POOL_ADMIN role on-chain
  const { 
    data: hasRole, 
    isLoading, 
    isError,
    error 
  } = useReadContract({
    address: ADMIN_CONTRACTS.ACL_MANAGER as `0x${string}`,
    abi: ACL_MANAGER_ABI,
    functionName: 'hasRole',
    args: poolAdminRole && address ? [poolAdminRole as `0x${string}`, address as `0x${string}`] : undefined,
    query: {
      enabled: !!poolAdminRole && !!address && isConnected && isWhitelisted,
    },
  });

  // Handle loading state
  useEffect(() => {
    if (!isConnected || !address || !isWhitelisted) {
      setIsChecking(false);
      return;
    }

    // If we have a result (success or error), stop checking
    if (hasRole !== undefined || isError) {
      setIsChecking(false);
      if (isError) {
        console.error('Error checking admin role:', error);
      }
    } else if (!isLoading && poolAdminRole) {
      // If not loading but no result, also stop checking
      setIsChecking(false);
    }
  }, [hasRole, isLoading, isError, error, isConnected, address, isWhitelisted, poolAdminRole]);

  const hasPoolAdminRole = hasRole === true;

  return {
    isAdmin: hasPoolAdminRole && isWhitelisted,
    isChecking,
    hasPoolAdminRole,
    address,
    isConnected,
  };
}


