/**
 * Dynamic Reserve Hook
 * Fetches active reserves from on-chain and combines with metadata
 */

import { useReadContracts } from 'wagmi';
import { CONTRACTS } from '../config/contracts';
import { TOKEN_METADATA, getTokenMetadata, getAllKnownTokens, TokenMetadata } from '../config/tokenMetadata';

// Configurator ABI for reading reserve config
const CONFIGURATOR_ABI = [
  {
    "inputs": [{ "internalType": "address", "name": "asset", "type": "address" }],
    "name": "getReserveConfig",
    "outputs": [{
      "components": [
        { "internalType": "address", "name": "underlyingAsset", "type": "address" },
        { "internalType": "euint64", "name": "totalSupplied", "type": "uint256" },
        { "internalType": "euint64", "name": "totalBorrowed", "type": "uint256" },
        { "internalType": "euint64", "name": "availableLiquidity", "type": "uint256" },
        { "internalType": "uint64", "name": "lastUpdateTimestamp", "type": "uint64" },
        { "internalType": "bool", "name": "active", "type": "bool" },
        { "internalType": "bool", "name": "borrowingEnabled", "type": "bool" },
        { "internalType": "bool", "name": "isCollateral", "type": "bool" },
        { "internalType": "bool", "name": "isPaused", "type": "bool" },
        { "internalType": "uint64", "name": "collateralFactor", "type": "uint64" },
        { "internalType": "uint64", "name": "supplyCap", "type": "uint64" },
        { "internalType": "uint64", "name": "borrowCap", "type": "uint64" }
      ],
      "internalType": "struct Types.ConfidentialReserve",
      "name": "",
      "type": "tuple"
    }],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

// Oracle ABI for reading prices
const ORACLE_ABI = [
  {
    "inputs": [{ "internalType": "address", "name": "asset", "type": "address" }],
    "name": "getPrice",
    "outputs": [{ "internalType": "uint64", "name": "", "type": "uint64" }],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

export interface AvailableAsset extends TokenMetadata {
  address: string;
  active: boolean;
  borrowingEnabled: boolean;
  isCollateral: boolean;
  isPaused: boolean;
  ltv: number; // As percentage (75 for 75%)
  price: number; // In USD
  supplyCap: string;
  borrowCap: string;
}

interface UseAvailableReservesReturn {
  supplyAssets: AvailableAsset[];
  borrowAssets: AvailableAsset[];
  collateralAssets: AvailableAsset[];
  allAssets: AvailableAsset[];
  isLoading: boolean;
  refetch: () => void;
}

export function useAvailableReserves(): UseAvailableReservesReturn {
  // Get all known token addresses from metadata
  const knownTokenAddresses = getAllKnownTokens();

  // Fetch reserve configs for all known tokens
  const { data: reserveData, isLoading: isLoadingReserves, refetch } = useReadContracts({
    contracts: knownTokenAddresses.map(address => ({
      address: CONTRACTS.POOL_CONFIGURATOR as `0x${string}`,
      abi: CONFIGURATOR_ABI,
      functionName: 'getReserveConfig',
      args: [address as `0x${string}`],
    })),
    query: {
      retry: 3, // Retry 3 times on failure
      retryDelay: 1000, // Wait 1s between retries
      staleTime: 30000, // Cache for 30 seconds
      refetchOnMount: true, // Always fetch on mount
      refetchOnWindowFocus: false, // Don't refetch on window focus
    }
  });

  // Fetch prices for all known tokens
  const { data: priceData, isLoading: isLoadingPrices } = useReadContracts({
    contracts: knownTokenAddresses.map(address => ({
      address: CONTRACTS.PRICE_ORACLE as `0x${string}`,
      abi: ORACLE_ABI,
      functionName: 'getPrice',
      args: [address as `0x${string}`],
    })),
    query: {
      retry: 3, // Retry 3 times on failure
      retryDelay: 1000, // Wait 1s between retries
      staleTime: 30000, // Cache for 30 seconds
      refetchOnMount: true, // Always fetch on mount
      refetchOnWindowFocus: false, // Don't refetch on window focus
    }
  });

  const isLoading = isLoadingReserves || isLoadingPrices;

  // Combine on-chain data with metadata
  const allAssets: AvailableAsset[] = knownTokenAddresses
    .map((address, index) => {
      const metadata = getTokenMetadata(address);
      const reserveResult = reserveData?.[index];
      const priceResult = priceData?.[index];
      
      const reserve = reserveResult?.result as any;
      const price = priceResult?.result as any;

      if (!metadata || !reserve) {
        return null;
      }

      return {
        address,
        ...metadata,
        active: reserve.active || false,
        borrowingEnabled: reserve.borrowingEnabled || false,
        isCollateral: reserve.isCollateral || false,
        isPaused: reserve.isPaused || false,
        ltv: reserve.collateralFactor ? Number(reserve.collateralFactor) / 1e12 * 100 : 0,
        price: price ? Number(price) / 1e12 : 0,
        supplyCap: reserve.supplyCap ? (Number(reserve.supplyCap) / 1e12).toString() : '0',
        borrowCap: reserve.borrowCap ? (Number(reserve.borrowCap) / 1e12).toString() : '0',
      };
    })
    .filter((asset): asset is AvailableAsset => asset !== null);

  // Filter for different use cases
  const supplyAssets = allAssets.filter(a => a.active && !a.isPaused);
  const borrowAssets = allAssets.filter(a => a.active && a.borrowingEnabled && !a.isPaused);
  const collateralAssets = allAssets.filter(a => a.active && a.isCollateral && !a.isPaused);

  return {
    supplyAssets,
    borrowAssets,
    collateralAssets,
    allAssets,
    isLoading,
    refetch,
  };
}

