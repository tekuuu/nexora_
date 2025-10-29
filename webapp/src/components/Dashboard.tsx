'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAccount, useBalance, useConnect, useDisconnect, useWriteContract, useWaitForTransactionReceipt, useReadContract, useConfig } from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';
import isEqual from 'fast-deep-equal';
import { ConnectKitButton } from 'connectkit';
// Pool hooks - Updated to work with new Pool
import { useSuppliedBalance } from '../hooks/useSuppliedBalance';
// OLD: useVaultTVL, useSharePercentage (not needed with Pool)
import { useConfidentialTokenBalance } from '../hooks/useConfidentialTokenBalance';
import { useMasterDecryption } from '../hooks/useMasterDecryption';
import { useAvailableReserves } from '../hooks/useAvailableReserves';
// NEW: Efficient balance management hooks
import { useSmartBalances } from '../hooks/useSmartBalances';
import ContractStatusBanner from './ContractStatusBanner';
import { getSafeContractAddresses } from '../config/contractConfig';
import { CONTRACTS, TOKEN_INFO } from '../config/contracts';
import { TOKEN_METADATA } from '../config/tokenMetadata';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Container,
  Box,
  Card,
  CardContent,
  Grid,
  Chip,
  CircularProgress,
  Tabs,
  Tab,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Alert,
} from '@mui/material';
import { AccountBalanceWallet, ContentCopy, ExpandMore, Close, SwapHoriz, Lock, LockOpen, Cached, AccountBalance, Percent } from '@mui/icons-material';
import { Tooltip } from '@mui/material';
import useTransactionHistory from '../hooks/useTransactionHistory';
import { useRouter } from 'next/navigation';
import { isAdminWallet } from '../config/admin/adminConfig';
import SupplyForm from './SupplyForm';
import WithdrawForm from './WithdrawForm';
import BorrowForm from './BorrowForm';
import RepayForm from './RepayForm';
import GenericTokenConverter from './GenericTokenConverter';
import PositionList from './PositionList';
import TransactionHistoryTable from './TransactionHistoryTable';
import TokenList from './TokenList';
import DynamicAssetSelector from './DynamicAssetSelector';
import WalletAssetBreakdown from './WalletAssetBreakdown';
import styles from './SwapStyles.module.css';
// MarketsTab import removed from Dashboard — Markets live in their own dedicated tab/page.
import MarketsTab from './MarketsTab';
import UserOverviewSection from './UserOverviewSection';
import UserSuppliesSection from './UserSuppliesSection';
import UserBorrowsSection from './UserBorrowsSection';
import { useTheme } from '../contexts/ThemeContext';
import { useBorrowedBalances } from '../hooks/useBorrowedBalances';
import { useReserveTotals } from '../hooks/useReserveTotals';
import { useSuppliedBalances } from '../hooks/useSuppliedBalances';
import type { AvailableAsset } from '../hooks/useAvailableReserves';
import useCollateralToggle from '../hooks/useCollateralToggle';
import { encryptAndRegister } from '../utils/fhe';
import { readContract, waitForTransactionReceipt } from '@wagmi/core';
import { parseUnits } from 'viem';

// Contract ABI for ConfidentialWETH wrap/unwrap functions
const CWETH_ABI = [
  {
    "inputs": [],
    "name": "wrap",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "externalEuint64",
        "name": "encryptedAmount",
        "type": "bytes32"
      },
      {
        "internalType": "bytes",
        "name": "inputProof",
        "type": "bytes"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "unwrap",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "operator",
        "type": "address"
      },
      {
        "internalType": "uint48",
        "name": "until",
        "type": "uint48"
      }
    ],
    "name": "setOperator",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "owner",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "operator",
        "type": "address"
      }
    ],
    "name": "isOperator",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
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
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

// ABI for ConfidentialTokenSwapper
const TOKEN_SWAPPER_ABI = [
  {
    "inputs": [
      {"internalType": "address", "name": "erc20Token", "type": "address"},
      {"internalType": "uint256", "name": "amount", "type": "uint256"},
      {"internalType": "address", "name": "to", "type": "address"}
    ],
    "name": "swapERC20ToConfidential",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "confidentialToken", "type": "address"},
      {"internalType": "externalEuint64", "name": "encryptedAmount", "type": "bytes32"},
      {"internalType": "bytes", "name": "inputProof", "type": "bytes"}
    ],
    "name": "swapConfidentialToERC20",
    "outputs": [{"internalType": "uint256", "name": "requestId", "type": "uint256"}],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint256", "name": "requestId", "type": "uint256"},
      {"internalType": "bytes", "name": "cleartexts", "type": "bytes"},
      {"internalType": "bytes", "name": "decryptionProof", "type": "bytes"}
    ],
    "name": "finalizeSwap",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint256", "name": "requestId", "type": "uint256"}
    ],
    "name": "getPendingSwap",
    "outputs": [
      {"internalType": "address", "name": "receiver", "type": "address"},
      {"internalType": "address", "name": "erc20Token", "type": "address"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "confidentialToken", "type": "address"}
    ],
    "name": "getERC20Token",
    "outputs": [
      {"internalType": "address", "name": "", "type": "address"}
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

// ABI for ERC20 tokens
const ERC20_ABI = [
  {
    "inputs": [
      {"internalType": "address", "name": "owner", "type": "address"},
      {"internalType": "address", "name": "spender", "type": "address"}
    ],
    "name": "allowance",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "spender", "type": "address"},
      {"internalType": "uint256", "name": "amount", "type": "uint256"}
    ],
    "name": "approve",
    "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "account", "type": "address"}
    ],
    "name": "balanceOf",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

export default function Dashboard(): JSX.Element {
  // Prevent hydration mismatch by only rendering after client mount
  const [isMounted, setIsMounted] = useState(false);
  const router = useRouter();
  
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const { address, isConnected } = useAccount();

  // Auto-redirect admin wallets to admin panel
  useEffect(() => {
    if (isConnected && address && isAdminWallet(address)) {
      router.push('/admin');
    }
  }, [isConnected, address, router]);
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: balance, isLoading: isBalanceLoading, error: balanceError } = useBalance({
    address: address,
  });
  const config = useConfig();
  const queryClient = useQueryClient();

  // Debug balance data
  useEffect(() => {
    if (address) {
      console.log('💰 Balance Debug:', {
        address,
        balance,
        isBalanceLoading,
        balanceError,
        formatted: balance?.formatted,
        value: balance?.value?.toString(),
        rpcUrl: process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || 'fallback',
        environment: process.env.NODE_ENV
      });
    }
  }, [address, balance, isBalanceLoading, balanceError]);

  // Additional balance error debugging
  useEffect(() => {
    if (balanceError) {
      console.error('🚨 Balance Error Details:', {
        error: balanceError,
        address,
        isConnected,
        rpcUrl: process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || 'fallback',
        environment: process.env.NODE_ENV
      });
    }
  }, [balanceError, address, isConnected]);

  // Master decryption hook - controls all encrypted balances
  const { 
    isAllDecrypted, 
    isDecrypting: isMasterDecrypting, 
    masterSignature,
    unlockAllBalances, 
    lockAllBalances, 
    canDecrypt: canMasterDecrypt,
    getMasterSignature
  } = useMasterDecryption();

  // NEW: Smart multi-token balance hooks - Efficient balance management (DISABLED for now to prevent spamming)
  // const {
  //   walletBalances,
  //   suppliedBalances,
  //   decryptWalletBalance,
  //   decryptSuppliedBalance,
  //   invalidateAfterTransaction,
  //   isLoadingWallet,
  //   isLoadingSupplied
  // } = useSmartBalances(masterSignature, getMasterSignature);

  // Pool position hook - Updated to work with Pool's getUserSuppliedBalance (removed single cWETH hook, using map instead)

  // Borrowed balances across borrowable assets (for Borrow positions list)
  const {
    balances: borrowedBalances,
    isLoading: isLoadingBorrowed,
    decryptAllBalances: decryptAllBorrowed,
    forceRefresh: forceRefreshBorrowed,
    refetch: refetchBorrowed
  } = useBorrowedBalances(masterSignature, getMasterSignature);
  
  const {
    totals,
    isLoading: isLoadingTotals,
    isDecrypting,
    decryptAllTotals,
    forceRefresh: forceRefreshReserveTotals
  } = useReserveTotals(masterSignature, getMasterSignature);

  // Backwards-compatible alias used elsewhere in this file
  const reserveTotals = totals;
  const isDecryptingTotals = isDecrypting;

  // Handlers to integrate with MarketsTab
  const handleSupplyClick = (asset: AvailableAsset) => {
    setSelectedAsset({
      address: asset.address,
      symbol: asset.symbol,
      decimals: asset.decimals,
      name: asset.name,
      icon: asset.icon,
      color: asset.color
    });
    setShowSupplyModal(true);
  };

  const handleBorrowClick = (asset: AvailableAsset) => {
    setSelectedAsset({
      address: asset.address,
      symbol: asset.symbol,
      decimals: asset.decimals,
      ltv: asset.ltv,
      price: asset.price
    });
    setShowBorrowModal(true);
  };

  const handleDecryptAllTotals = () => {
    if (typeof decryptAllTotals === 'function') decryptAllTotals();
  };

  // Withdraw handler for supplies
  const handleWithdrawClick = (asset: { address: string; symbol: string; decimals: number; name?: string; icon?: string; color?: string }) => {
    setSelectedAsset({
      address: asset.address,
      symbol: asset.symbol,
      decimals: asset.decimals,
      name: asset.name,
      icon: asset.icon,
      color: asset.color,
    });
    setShowWithdrawModal(true);
  };

  const handleNavigateToMarkets = () => {
    setActiveTab('markets');
  };

  // Repay handler for borrows
  const handleRepayClick = (asset: { address: string; symbol: string; decimals: number; name?: string; icon?: string; color?: string; price?: number }) => {
    // Ensure decimals is populated; if missing, try to derive from supplyAssets or borrowAssets
    let decimals = (asset as any).decimals;
    if (decimals === undefined || decimals === null) {
      const byAddress = (supplyAssets || []).find(a => a.address?.toLowerCase() === asset.address?.toLowerCase())
        || (borrowAssets || []).find(a => a.address?.toLowerCase() === asset.address?.toLowerCase());
      if (byAddress && typeof byAddress.decimals === 'number') {
        decimals = byAddress.decimals;
      } else {
        const bySymbol = (supplyAssets || []).find(a => a.symbol === asset.symbol)
          || (borrowAssets || []).find(a => a.symbol === asset.symbol);
        if (bySymbol && typeof bySymbol.decimals === 'number') decimals = bySymbol.decimals;
      }
    }

    setSelectedAsset({
      address: asset.address,
      symbol: asset.symbol,
      decimals: typeof decimals === 'number' ? decimals : 18,
      name: asset.name,
      icon: asset.icon,
      color: asset.color,
      price: asset.price,
    });
    setShowRepayModal(true);
  };

  // Helper: check if user has an active borrow for a given asset symbol
  const hasActiveBorrowsForSymbol = useCallback((symbol: string) => {
    if (!borrowedBalances) return false;
    const entry = Object.values(borrowedBalances).find((b: any) => b && b.symbol === symbol);
    if (!entry) return false;
    try {
      const raw = (entry as any).amount;
      const asNumber = typeof raw === 'bigint' ? Number(raw) : Number(raw || 0);
      return Boolean(!Number.isNaN(asNumber) && asNumber > 0);
    } catch (e) {
      return false;
    }
  }, [borrowedBalances]);

  // Collateral toggle hook
  const { toggleCollateral, isToggling: isCollateralToggling, error: collateralToggleError } = useCollateralToggle();

  // Trigger used to refresh collateral flags when toggles complete
  const [collateralRefreshTrigger, setCollateralRefreshTrigger] = useState(0);

  useEffect(() => {
    const onToggled = (event: any) => {
      console.log('🎯 Collateral toggled event received:', event.detail);
      // Immediately trigger a refresh instead of waiting for debounce
      setCollateralRefreshTrigger(c => c + 1);
    };
    window.addEventListener('collateralToggled', onToggled as EventListener);
    return () => window.removeEventListener('collateralToggled', onToggled as EventListener);
  }, []);

  // Supply positions count for tab badge
  const { balances: suppliedBalancesMap, isLoading: isLoadingSupplied } = useSuppliedBalances(masterSignature, getMasterSignature);
  const supplyPositionsCount = useMemo(() =>
    Object.values(suppliedBalancesMap || {}).filter((b: any) => b && (b as any).hasSupplied).length
  , [suppliedBalancesMap]);

  // Transaction history hook (for Total Transactions metric)
  const { totalTransactions } = useTransactionHistory();

  // Calculate active positions count for Portfolio Analytics
  const activePositionsCount = useMemo(() => {
    const activeSupplyCount = Object.values(suppliedBalancesMap || {}).filter((b: any) => b && (b as any).hasSupplied).length;
    const activeBorrowCount = Object.values(borrowedBalances || {}).filter((b: any) => b && (b as any).hasBorrowed).length;
    return activeSupplyCount + activeBorrowCount;
  }, [suppliedBalancesMap, borrowedBalances]);
  
  // OLD: Share percentage not needed with Pool (direct positions)
  const sharePercentage = '0';
  const hasShares = false;
  const isDecryptingShares = false;
  const refreshShares = useCallback(() => {
    // Placeholder - no-op. Replace with real implementation if needed.
  }, []);

  // ERC20 token balance hooks using built-in Wagmi
  const { data: wethBalance, refetch: refetchWETHBalance } = useReadContract({
    address: CONTRACTS.WETH as `0x${string}`,
    abi: [
      {
        "inputs": [{"internalType": "address", "name": "account", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
      }
    ],
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: false } // DISABLED to prevent 429 errors
  });

  const { data: usdcBalance, refetch: refetchUSDCBalance } = useReadContract({
    address: CONTRACTS.USDC as `0x${string}`,
    abi: [
      {
        "inputs": [{"internalType": "address", "name": "account", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
      }
    ],
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: false } // DISABLED to prevent 429 errors
  });

  const { data: daiBalance, refetch: refetchDAIBalance } = useReadContract({
    address: CONTRACTS.DAI as `0x${string}`,
    abi: [
      {
        "inputs": [{"internalType": "address", "name": "account", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
      }
    ],
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: false } // DISABLED to prevent 429 errors
  });
  
  const cwethBalance = useConfidentialTokenBalance(
    { address: CONTRACTS.CONFIDENTIAL_WETH, symbol: 'WETH', decimals: 6 },
    masterSignature, 
    getMasterSignature
  );
  const cusdcBalance = useConfidentialTokenBalance(
    { address: CONTRACTS.CONFIDENTIAL_USDC, symbol: 'USDC', decimals: 6 },
    masterSignature, 
    getMasterSignature
  );
  const cdaiBalance = useConfidentialTokenBalance(
    { address: CONTRACTS.CONFIDENTIAL_DAI, symbol: 'DAI', decimals: 6 },
    masterSignature, 
    getMasterSignature
  );

  // Dynamic reserves - fetches all active reserves from on-chain
  const { supplyAssets, borrowAssets, collateralAssets, isLoading: isLoadingReserves } = useAvailableReserves();

  // Per-asset user collateral status: populate a symbol -> boolean map using direct RPC reads.
  // IMPORTANT: we must NOT call React hooks inside loops. Instead perform safe contract reads
  // inside a useEffect and store the results in component state.
  const [userCollateralEnabledBySymbol, setUserCollateralEnabledBySymbol] = useState<Record<string, boolean>>({});

  // Refs to prevent concurrent fetchFlags calls, manage debounce timeout, and check dependency changes
  const isFetchingRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevDepsRef = useRef({ address, supplyAssets, config, collateralRefreshTrigger });

  useEffect(() => {
    const currentDeps = { address, supplyAssets, config, collateralRefreshTrigger };
    if (isEqual(prevDepsRef.current, currentDeps)) {
      return;
    }
    prevDepsRef.current = currentDeps;

    let mounted = true;
    const safeContracts = getSafeContractAddresses();
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
      }
    ] as const;

    const fetchFlags = async () => {
      if (!mounted) return;
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;

      if (!address || !supplyAssets || supplyAssets.length === 0) {
        if (mounted) setUserCollateralEnabledBySymbol({});
        isFetchingRef.current = false;
        return;
      }

      const poolAddr = (safeContracts?.POOL_ADDRESS as `0x${string}`) || (CONTRACTS.LENDING_POOL as `0x${string}`);
      if (!poolAddr) {
        // No pool address available; default to empty map
        if (mounted) setUserCollateralEnabledBySymbol({});
        isFetchingRef.current = false;
        return;
      }

      try {
        const entries = await Promise.all(supplyAssets.map(async (asset) => {
          try {
            const res = await readContract(config, {
              address: poolAddr,
              abi: POOL_ABI,
              functionName: 'userCollateralEnabled',
              args: [address as `0x${string}`, asset.address as `0x${string}`],
            });
            return [asset.symbol, Boolean(res)] as const;
          } catch (err) {
            // On error, default to false for safety
            return [asset.symbol, false] as const;
          }
        }));

        if (!mounted) {
          isFetchingRef.current = false;
          return;
        }
        const map: Record<string, boolean> = {};
        entries.forEach(([sym, enabled]) => { map[sym] = enabled; });
        console.log('🔄 Collateral state updated:', map);
        setUserCollateralEnabledBySymbol(map);
      } catch (err) {
        console.error('Failed to fetch user collateral flags:', err);
        if (mounted) setUserCollateralEnabledBySymbol({});
      } finally {
        isFetchingRef.current = false;
      }
    };

    // Clear existing timeout if any
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Invalidate existing queries to ensure fresh data
    if (address && supplyAssets.length > 0) {
      const poolAddr = (safeContracts?.POOL_ADDRESS as `0x${string}`) || (CONTRACTS.LENDING_POOL as `0x${string}`);
      if (poolAddr) {
        queryClient.invalidateQueries({ queryKey: ['readContract', poolAddr] });
      }
    }

    // Always fetch immediately to ensure fresh onchain data
    console.log('🔄 Fetching collateral state from onchain');
    fetchFlags();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      mounted = false;
    };
  }, [address, supplyAssets, config, collateralRefreshTrigger]);
  
  // Prepare available assets for WalletAssetBreakdown component
  const availableWalletAssets = useMemo(() => {
    return supplyAssets.map(asset => ({
      address: asset.address,
      symbol: asset.symbol,
      decimals: asset.decimals,
      name: asset.name,
      icon: asset.icon,
      color: asset.color || '#627EEA',
    }));
  }, [supplyAssets]);
  
  const [activeTab, setActiveTab] = useState<'dashboard' | 'markets' | 'portfolio'>('dashboard');
  const [walletInfoAnchor, setWalletInfoAnchor] = useState<null | HTMLElement>(null);
  const [selectedNetwork, setSelectedNetwork] = useState('Sepolia');
  const [showNetworkDropdown, setShowNetworkDropdown] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [useVerticalNav, setUseVerticalNav] = useState(false);
  
  const navigationTabs: ('dashboard' | 'markets' | 'portfolio')[] = ['dashboard', 'markets', 'portfolio'];
  
  // Dynamic breakpoint detection
  useEffect(() => {
    const checkLayout = () => {
      // Switch to vertical nav when window width is less than 900px
      // This ensures horizontal tabs don't push controls out of view
      setUseVerticalNav(window.innerWidth < 900);
    };

    // Only run after component is mounted to avoid hydration issues
    if (typeof window !== 'undefined') {
      checkLayout();
      
      window.addEventListener('resize', checkLayout);
      
      return () => window.removeEventListener('resize', checkLayout);
    }
}, []);
  
  const availableNetworks = [
    { name: 'Ethereum', chainId: 1, functional: false, icon: '/assets/icons/eth-svgrepo-com.svg' },
    { name: 'Sepolia', chainId: 11155111, functional: true, icon: '/assets/icons/ethereum.svg' },
    { name: 'Polygon', chainId: 137, functional: false, icon: '/assets/icons/polygon-matic-logo.svg' },
    { name: 'Arbitrum', chainId: 42161, functional: false, icon: '/assets/icons/arbitrum-arb-logo.svg' },
    { name: 'Optimism', chainId: 10, functional: false, icon: '/assets/icons/optimism-ethereum-op-logo.svg' },
    { name: 'Base', chainId: 8453, functional: false, icon: '/assets/icons/base_logo.jpg' }
  ];
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [showSupplyModal, setShowSupplyModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showBorrowModal, setShowBorrowModal] = useState(false);
  const [showRepayModal, setShowRepayModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  
  const [portfolioSubTab, setPortfolioSubTab] = useState('overview'); // 'overview' or 'history'
  const [showNotificationBanner, setShowNotificationBanner] = useState(true);
  const [swapAmount, setSwapAmount] = useState('');
  const [isSwapping, setIsSwapping] = useState(false);
  const [selectedToken, setSelectedToken] = useState('WETH');
  const [tokenDropdownOpen, setTokenDropdownOpen] = useState(false);
  const [isReversed, setIsReversed] = useState(false);
  const [fheInitialized, setFheInitialized] = useState(false);
  const [fheError, setFheError] = useState<string | null>(null);
  const [showBalanceError, setShowBalanceError] = useState(false);
  const [swapTransactionError, setSwapTransactionError] = useState<string | null>(null);
  const [swapUserCancelled, setSwapUserCancelled] = useState(false);
  const [swapSuccess, setSwapSuccess] = useState(false);
  // Move theme state to context (useTheme hook)
  const { isDarkMode, toggleTheme } = useTheme();
  const [isSwapCompleted, setIsSwapCompleted] = useState(false); // Local state to override wagmi pending states
  const [lastSwapAmount, setLastSwapAmount] = useState('');

  // Swap functionality hooks
  const { writeContract: writeSwapContract, writeContractAsync, data: swapHash, isPending: isSwapPending, error: swapError, reset: resetSwapWrite } = useWriteContract();
  const { isLoading: isSwapConfirming, isSuccess: isSwapSuccess } = useWaitForTransactionReceipt({ hash: swapHash });

  // TVL hook - RE-ENABLED after fixing rate limiting issues
  // OLD VAULT TVL HOOK - DISABLED (using new Pool now)
  // const { tvlBalance: vaultTVL, hasTVL, isDecrypted: isTVLDecrypted, isDecrypting: isDecryptingTVL, isLoadingTVL: isTVLLoading, canDecrypt: canDecryptTVL, decryptTVL, lockTVL: lockTVLIndividual, refreshTVL } = useVaultTVL(masterSignature, getMasterSignature, isSwapPending || isSwapConfirming);
  
  // Placeholder values for disabled TVL hook
  const vaultTVL = '0';
  const hasTVL = false;
  const isTVLDecrypted = false;
  const isDecryptingTVL = false;
  const isTVLLoading = false;
  const canDecryptTVL = false;
  const decryptTVL = () => {};
  const lockTVLIndividual = () => {};
  const refreshTVL = useCallback(() => {
    // Placeholder - no-op. Replace with real implementation if needed.
  }, []);

  // Check if any decryption is in progress
  const isAnyDecrypting = cwethBalance.isDecrypting || cusdcBalance.isDecrypting || isMasterDecrypting || isDecryptingTVL;

  // Initialize FHE on component mount
  useEffect(() => {
    const initializeFHE = async () => {
      if (!isConnected || !address) return;
      
      try {
        console.log('🔧 Initializing FHE for swap functionality...');
        const { getFHEInstance } = await import('../utils/fhe');
        await getFHEInstance();
        setFheInitialized(true);
        setFheError(null);
        console.log('✅ FHE initialized successfully');
      } catch (error) {
        console.error('❌ FHE initialization failed:', error);
        setFheError(error instanceof Error ? error.message : 'Failed to initialize FHE');
        setFheInitialized(false);
      }
    };

    initializeFHE();
  }, [isConnected, address]);

  // Refresh all blockchain data - wrapped in useCallback to stabilize identity
  const refreshAllBalances = useCallback(async () => {
    console.log('🔄 Refreshing all blockchain data including TVL...');
    try {
      await Promise.all([
        refetchWETHBalance(),
        refetchUSDCBalance(),
        cwethBalance.forceRefresh(),
        cusdcBalance.forceRefresh(),
        refreshShares(),
        refreshTVL(), // Use explicit TVL refresh for immediate update
        forceRefreshBorrowed(),
        forceRefreshReserveTotals()
      ]);
      console.log('✅ All blockchain data refreshed');
    } catch (error) {
      console.error('❌ Error refreshing blockchain data:', error);
    }
  }, [
    refetchWETHBalance,
    refetchUSDCBalance,
    // include the stable function references for confidential balance refresh
    cwethBalance,
    cusdcBalance,
    refreshShares,
    refreshTVL,
    forceRefreshBorrowed,
    forceRefreshReserveTotals
  ]);

  // NEW: Create transaction-specific callbacks (invalidation disabled for now)
  const handleSupplySuccess = useCallback(async () => {
    if (selectedAsset) {
      console.log(`📝 Supply transaction completed for ${selectedAsset.symbol}`);
      // invalidateAfterTransaction('supply', selectedAsset.symbol);
    }
    await refreshAllBalances();
  }, [selectedAsset, refreshAllBalances]);

  const handleWithdrawSuccess = useCallback(async () => {
    if (selectedAsset) {
      console.log(`📝 Withdraw transaction completed for ${selectedAsset.symbol}`);
      // invalidateAfterTransaction('withdraw', selectedAsset.symbol);
    }
    await refreshAllBalances();
  }, [selectedAsset, refreshAllBalances]);

  const handleBorrowSuccess = useCallback(async () => {
    if (selectedAsset) {
      console.log(`📝 Borrow transaction completed for ${selectedAsset.symbol}`);
    }
    await refreshAllBalances();
    forceRefreshBorrowed();
  }, [selectedAsset, refreshAllBalances, forceRefreshBorrowed]);

  const handleRepaySuccess = useCallback(async () => {
    if (selectedAsset) {
      console.log(`📝 Repay transaction completed for ${selectedAsset.symbol}`);
    }
    await refreshAllBalances();
    forceRefreshBorrowed();
  }, [selectedAsset, refreshAllBalances, forceRefreshBorrowed]);

  // Debug function to manually clear FHEVM cache
  const forceClearFHEVMCache = useCallback(() => {
    if (address && typeof window !== 'undefined') {
      console.log('🧹 Manually clearing all FHEVM cache for debugging...');
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes(address) && (
          key.includes('fhevm') || 
          key.includes('decryption') || 
          key.includes('signature') ||
          key.includes('encrypted')
        )) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      console.log(`🧹 Cleared ${keysToRemove.length} FHEVM-related localStorage items`);
      
      // Force refresh all balances
      refreshAllBalances();
    }
  }, [address, refreshAllBalances]);

  // Simple notification when master signature is available (hooks handle decryption automatically)
  useEffect(() => {
    if (masterSignature && !isMasterDecrypting) {
      console.log('✅ Master signature available - confidential balances will auto-decrypt');
      // The useConfidentialTokenBalance hooks handle auto-decryption automatically
      // No need for aggressive loops that cause rate limiting!
    }
  }, [masterSignature, isMasterDecrypting]);


  // Smart refresh after transactions - ONLY refresh once to avoid rate limiting
  useEffect(() => {
    if (isSwapSuccess) {
      console.log('🎉 Swap transaction completed!');
      
      // Refresh ERC20 balances immediately
      refreshAllBalances();
      
      // Refresh confidential balances ONCE after a delay (to ensure blockchain state is updated)
      console.log('🔄 Scheduling single confidential balance refresh after transaction...');
      setTimeout(() => {
        console.log('📊 Refreshing confidential balances after transaction...');
        cwethBalance.forceRefresh();
        cusdcBalance.forceRefresh();
      }, 2000); // 2 second delay to ensure blockchain state is finalized
    }
  }, [isSwapSuccess, refreshAllBalances, cwethBalance, cusdcBalance]);

  // TVL refresh when swap completes - DISABLED to reduce RPC calls
  // useEffect(() => {
  //   if (isSwapSuccess) {
  //     console.log('🎉 Swap completed, refreshing TVL...');
  //     refreshTVL();
  //   }
  // }, [isSwapSuccess, refreshTVL]);

  // Handle swap transaction success
  useEffect(() => {
    if (isSwapSuccess && swapHash) {
      console.log('✅ Swap transaction successful!');
      console.log('🎯 Setting swapSuccess to true');
      setSwapSuccess(true);
      setLastSwapAmount(swapAmount);
      setSwapAmount('');
      setSwapTransactionError(null);
      setSwapUserCancelled(false);
      setIsSwapCompleted(true); // Mark swap as completed to override pending states
      
      // Smart invalidation for swap transaction (disabled for now)
      const confidentialSymbol = selectedToken === 'WETH' ? 'cWETH' : 
                                  selectedToken === 'USDC' ? 'cUSDC' : 'cDAI';
      console.log(`📝 Swap transaction completed for ${confidentialSymbol}`);
      // invalidateAfterTransaction('swap', confidentialSymbol);
      
      // Reset the write contract state to clear pending states
      setTimeout(() => {
        resetSwapWrite();
        setIsSwapCompleted(false); // Reset local state after wagmi reset
      }, 100);
      
      // Hide success message after 5 seconds
      setTimeout(() => {
        console.log('🕐 Hiding success message after 5 seconds');
        setSwapSuccess(false);
      }, 5000);
    }
  }, [isSwapSuccess, swapHash, resetSwapWrite, selectedToken]);

  // Handle swap transaction errors
  useEffect(() => {
    if (swapError) {
      console.log('Swap transaction error:', swapError);
      
      // Check if user rejected the transaction
      if (swapError.message.toLowerCase().includes('user rejected') || 
          swapError.message.toLowerCase().includes('user denied') ||
          swapError.message.toLowerCase().includes('rejected the request')) {
        console.log('🚫 User cancelled swap transaction');
        setSwapUserCancelled(true);
        setSwapTransactionError(null);
        setSwapAmount(''); // Clear input on cancellation
      } else {
        console.log('❌ Swap transaction failed with error:', swapError.message);
        // Other errors (network, contract, etc.)
        setSwapTransactionError(swapError.message);
        setSwapUserCancelled(false);
        setSwapAmount(''); // Clear input on error
      }
      
      setIsSwapCompleted(true); // Mark swap as completed to override pending states
      
      // Reset the write contract state to clear pending states
      setTimeout(() => {
        resetSwapWrite();
        setIsSwapCompleted(false); // Reset local state after wagmi reset
      }, 100);
    }
  }, [swapError, resetSwapWrite]);

  // Contract addresses
  // Get contract addresses with validation
  const contractAddresses = getSafeContractAddresses();
  const CWETH_ADDRESS = contractAddresses?.CWETH_ADDRESS;

  // Available tokens for swap
  const availableTokens = [
    { symbol: 'WETH', name: 'Wrapped Ether', icon: '/assets/icons/eth-svgrepo-com.svg', functional: true },
    { symbol: 'USDC', name: 'USD Coin', icon: '/assets/icons/usdc-svgrepo-com.svg', functional: true },
    { symbol: 'DAI', name: 'Dai Stablecoin', icon: '/assets/icons/multi-collateral-dai-dai-logo.svg', functional: true },
    { symbol: 'ETH', name: 'Ethereum', icon: '/assets/icons/eth-svgrepo-com.svg', functional: false },
    { symbol: 'USDT', name: 'Tether', icon: '/assets/icons/usdt-svgrepo-com.svg', functional: false },
    { symbol: 'UNI', name: 'Uniswap', icon: '/assets/icons/uniswap-uni-logo.svg', functional: false },
    { symbol: 'BTC', name: 'Bitcoin', icon: '/assets/icons/bitcoin-svgrepo-com.svg', functional: false },
  ];


  // Initialize FHE for unwrap functionality
  useEffect(() => {
    const initializeFHE = async () => {
      if (!isConnected || !address) return;
      
      try {
        console.log('🔧 Initializing FHE for dashboard unwrap functionality...');
        const { getFHEInstance } = await import('../utils/fhe');
        await getFHEInstance();
        setFheInitialized(true);
        setFheError(null);
        console.log('✅ FHE initialized successfully in dashboard');
      } catch (error) {
        console.error('❌ FHE initialization failed in dashboard:', error);
        setFheError(error instanceof Error ? error.message : 'Failed to initialize FHE');
        setFheInitialized(false);
      }
    };

    initializeFHE();
  }, [isConnected, address]);

  // Handle SupplyForm close event
  useEffect(() => {
    // Only run in browser environment to avoid hydration issues
    if (typeof window === 'undefined') {
      return;
    }

    const handleCloseSupplyDialog = () => {
      setShowSupplyModal(false);
    };

    const handleCloseWithdrawDialog = () => {
      setShowWithdrawModal(false);
    };

    window.addEventListener('closeSupplyDialog', handleCloseSupplyDialog);
    window.addEventListener('closeWithdrawDialog', handleCloseWithdrawDialog);
    
    return () => {
      window.removeEventListener('closeSupplyDialog', handleCloseSupplyDialog);
      window.removeEventListener('closeWithdrawDialog', handleCloseWithdrawDialog);
    };
  }, []);




  const handleWalletInfoClick = (event: React.MouseEvent<HTMLElement>) => {
    setWalletInfoAnchor(event.currentTarget);
  };

  const handleCloseWalletInfo = () => {
    setWalletInfoAnchor(null);
  };

  const handleDisconnect = () => {
    disconnect();
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        // Remove any wagmi-related cached keys to avoid stale connector state
        const keys = Object.keys(localStorage || {});
        for (const k of keys) {
          if (k && k.startsWith('wagmi')) {
            localStorage.removeItem(k);
          }
        }
      }
    } catch (e) {
      // Non-fatal: continue with UI state cleanup even if localStorage access fails
      console.warn('Failed to clear wagmi localStorage keys on disconnect', e);
    }
    setWalletInfoAnchor(null);
  };

  const handleCopyAddress = async () => {
    if (address) {
      try {
        await navigator.clipboard.writeText(address);
        // You could add a toast notification here
      } catch (err) {
        console.error('Failed to copy address:', err);
      }
    }
  };

  // Swap functionality
  const handleSwap = async () => {
    console.log('🖱️ Swap button clicked!', {
      swapAmount,
      address,
      isReversed,
      fheInitialized,
      fheError,
      selectedToken
    });

    if (!swapAmount || !address || parseFloat(swapAmount) <= 0) {
      console.log('❌ Validation failed:', { swapAmount, address });
      return;
    }

    // Clear previous error states when starting new transaction
    setSwapTransactionError(null);
    setSwapUserCancelled(false);
    setShowBalanceError(false);
    setIsSwapCompleted(false); // Reset completion state for new transaction

    try {
      setIsSwapping(true);
      
      // Get token info and contract addresses
      const tokenInfo = TOKEN_INFO[
        selectedToken === 'WETH' ? CONTRACTS.WETH : 
        selectedToken === 'USDC' ? CONTRACTS.USDC : 
        CONTRACTS.DAI
      ];
      const erc20Address = 
        selectedToken === 'WETH' ? CONTRACTS.WETH : 
        selectedToken === 'USDC' ? CONTRACTS.USDC : 
        CONTRACTS.DAI;
      const confidentialAddress = 
        selectedToken === 'WETH' ? CONTRACTS.CONFIDENTIAL_WETH : 
        selectedToken === 'USDC' ? CONTRACTS.CONFIDENTIAL_USDC : 
        CONTRACTS.CONFIDENTIAL_DAI;
      const swapperAddress = CONTRACTS.TOKEN_SWAPPER as `0x${string}`;

      // Convert amounts for swap: native ERC20 decimals and confidential 6-decimals
      const decimals = tokenInfo.decimals;
      const amountNative = parseUnits(swapAmount, decimals); // ERC20 native decimals
      const amountE6 = parseUnits(swapAmount, 6); // Confidential tokens use 6 decimals
      
      if (isReversed) {
        // Confidential Token → ERC20 (unwrap)
        console.log('📤 Starting unwrap process...');
        
        // Check if FHE is initialized
        if (!fheInitialized) {
          console.log('❌ FHE not initialized');
          throw new Error('FHE not initialized. Please wait for initialization to complete.');
        }
        
        if (fheError) {
          console.log('❌ FHE error:', fheError);
          throw new Error(`FHE initialization failed: ${fheError}`);
        }
        
        // Encrypt amount for unwrap (6 decimals)
        console.log('🔐 Encrypting amount for unwrap (6 decimals):', amountE6.toString());
        
        let encryptedAmount;
        let formattedEncryptedAmount: `0x${string}`;
        let formattedInputProof: `0x${string}`;
        
        try {
          encryptedAmount = await encryptAndRegister(
            swapperAddress,
            address,
            amountE6
          );
          
          if (!encryptedAmount || !encryptedAmount.handles?.length || !encryptedAmount.inputProof) {
            throw new Error('Failed to encrypt amount for unwrap. Please try again.');
          }
          
          // Normalize the encrypted payload to match expected format
          const toHex = (v: any): `0x${string}` => {
            if (v instanceof Uint8Array) {
              return ('0x' + Array.from(v).map((b: number) => b.toString(16).padStart(2, '0')).join('')) as `0x${string}`;
            }
            if (typeof v === 'string') {
              return v.startsWith('0x') ? v as `0x${string}` : ('0x' + v) as `0x${string}`;
            }
            throw new Error('Unsupported encrypted payload type');
          };
          
          // Format as proper hex strings for contract call
          formattedEncryptedAmount = toHex(encryptedAmount.handles[0]);
          formattedInputProof = toHex(encryptedAmount.inputProof);
          
        } catch (encryptError) {
          console.error('❌ Encryption failed:', encryptError);
          throw encryptError;
        }
        
        // First check if swapper is approved as operator for confidential tokens
        console.log('🔍 Checking operator approval for confidential token...');
        const isOperator = await readContract(config, {
          address: confidentialAddress as `0x${string}`,
          abi: CWETH_ABI,
          functionName: 'isOperator',
          args: [address as `0x${string}`, swapperAddress as `0x${string}`],
        });

        if (!isOperator) {
          console.log('⚠️ Swapper not approved as operator, approving first...');
          const approveHash = await writeContractAsync({
            address: confidentialAddress as `0x${string}`,
            abi: CWETH_ABI as any, // Type assertion to avoid function name type error
            functionName: 'setOperator',
            args: [swapperAddress as `0x${string}`, BigInt(Math.floor(Date.now() / 1000) + 86400)], // Approve for 24 hours
          });
          console.log('✅ Operator approval transaction:', approveHash);
          await waitForTransactionReceipt(config, { hash: approveHash });
          console.log('✅ Operator approval confirmed');
        } else {
          console.log('✅ Swapper already approved as operator');
        }

        // Verify we have enough confidential token balance
        console.log('🔍 Verifying confidential token balance...');
        console.log('🔍 Checking balance for contract:', confidentialAddress);
        console.log('🔍 Checking balance for user:', address);
        try {
          const encryptedBalance = await readContract(config, {
            address: confidentialAddress as `0x${string}`,
            abi: CWETH_ABI,
            functionName: 'getEncryptedBalance',
            args: [address as `0x${string}`],
          });
          console.log('📊 Encrypted balance (bytes32):', encryptedBalance);
          console.log('📊 Encrypted balance (hex):', typeof encryptedBalance === 'string' ? encryptedBalance : 'Not a string');
          
          // Check if balance is zero (all zeros in hex)
          const isZeroBalance = encryptedBalance === '0x0000000000000000000000000000000000000000000000000000000000000000';
          console.log('📊 Is zero balance?', isZeroBalance);
          
          if (isZeroBalance) {
            throw new Error(`User has zero confidential token balance in contract ${confidentialAddress}. Please do a WETH → cWETH swap first to get tokens in the new contract.`);
          }
        } catch (balanceError) {
          console.warn('⚠️ Could not fetch encrypted balance:', balanceError);
          if (balanceError instanceof Error && balanceError.message.includes('zero confidential token balance')) {
            throw balanceError;
          }
        }

        // Verify token pair mapping
        console.log('🔍 Verifying token pair mapping...');
        try {
          const erc20Token = await readContract(config, {
            address: swapperAddress as `0x${string}`,
            abi: TOKEN_SWAPPER_ABI,
            functionName: 'getERC20Token',
            args: [confidentialAddress as `0x${string}`],
          });
          console.log('🔗 ERC20 token mapping:', erc20Token);
          console.log('🔗 Expected ERC20 token:', erc20Address);
          console.log('🔗 Mapping matches:', erc20Token.toLowerCase() === erc20Address.toLowerCase());
        } catch (mappingError) {
          console.warn('⚠️ Could not verify token mapping:', mappingError);
        }

        // Check if swapper contract has enough ERC20 tokens
        console.log('🔍 Checking swapper contract ERC20 balance...');
        try {
          const swapperBalance = await readContract(config, {
            address: erc20Address as `0x${string}`,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [swapperAddress as `0x${string}`],
          });
          // Convert 6-decimal amount to native ERC20 decimals for balance check
          const requiredNative = decimals >= 6
            ? amountE6 * (10n ** BigInt(decimals - 6))
            : amountE6 / (10n ** BigInt(6 - decimals));
          console.log('💰 Swapper ERC20 balance (native):', swapperBalance.toString());
          console.log('💰 Required amount (native):', requiredNative.toString());
          console.log('💰 Sufficient balance:', BigInt(swapperBalance.toString()) >= requiredNative);
          
          if (BigInt(swapperBalance.toString()) < requiredNative) {
            throw new Error(`Insufficient swapper balance: ${swapperBalance.toString()} < ${requiredNative.toString()}`);
          }
        } catch (balanceError) {
          console.warn('⚠️ Could not check swapper balance:', balanceError);
          if (balanceError instanceof Error && balanceError.message.includes('Insufficient swapper balance')) {
            throw balanceError;
          }
        }

        // Call the ConfidentialTokenSwapper unwrap function
        console.log('📤 Submitting unwrap transaction...');
        console.log('📋 Transaction details:', {
          swapperAddress,
          confidentialAddress,
          encryptedAmount: formattedEncryptedAmount,
          inputProof: formattedInputProof,
          amountE6: amountE6.toString(),
          userAddress: address
        });
        
        try {
          console.log('🔧 Constructing GATEWAY swap transaction (secure pattern - no plaintext amount)...');
          console.log('🔧 Function: swapConfidentialToERC20');
          console.log('🔧 Args:', {
            confidentialToken: confidentialAddress,
            encryptedAmount: formattedEncryptedAmount,
            inputProof: formattedInputProof
          });
        
        const result = await writeSwapContract({
            address: swapperAddress as `0x${string}`,
            abi: TOKEN_SWAPPER_ABI,
            functionName: 'swapConfidentialToERC20',
          args: [
              confidentialAddress as `0x${string}`,
            formattedEncryptedAmount, 
              formattedInputProof
          ],
        });
        console.log('✅ Gateway swap initiated - waiting for Gateway callback to finalize...');
        console.log('ℹ️ The swap will complete in 2 steps:');
        console.log('   1. ✅ Confidential tokens transferred (this transaction)');
        console.log('   2. ⏳ Gateway decrypts amount and calls finalizeSwap() to send ERC20');
        console.log('🔍 Transaction submitted:', result);
        
        // Note: writeContractAsync returns void, so we can't get the transaction hash directly
        // The transaction will be processed by the relayer and we'll see the result in the logs
        console.log('⏳ Transaction submitted to relayer, waiting for processing...');
        
        // Add a fallback mechanism to manually call finalizeSwap if the Gateway doesn't do it
        // This is a temporary workaround until the FHEVM Gateway issue is resolved
        console.log('🔧 Setting up finalizeSwap fallback mechanism...');
        
        // Wait a bit for the transaction to be processed, then check if finalizeSwap was called
        setTimeout(async () => {
          try {
            console.log('🔍 Checking if finalizeSwap was called automatically...');
            
            // Check the user's ERC20 balance to see if it increased
            const currentWETHBalance = await readContract(config, {
              address: CONTRACTS.WETH as `0x${string}`,
              abi: ERC20_ABI,
              functionName: 'balanceOf',
              args: [address as `0x${string}`],
            });
            
            console.log('🔍 Current WETH balance after swap:', currentWETHBalance.toString());
            
            // If balance hasn't increased, the finalizeSwap wasn't called
            // We might need to implement a manual call here
            console.log('⚠️ If WETH balance hasn\'t increased, finalizeSwap may not have been called by the Gateway');
            
          } catch (error) {
            console.error('❌ Error checking finalizeSwap status:', error);
          }
        }, 10000); // Wait 10 seconds for the transaction to be processed
        
        // Start aggressive refresh immediately after transaction submission
        console.log('🔄 Starting aggressive balance refresh after unwrap transaction...');
        
        // Immediate refresh
        setTimeout(() => {
          cwethBalance.forceRefresh();
          console.log('🔄 Immediate refresh triggered (100ms after transaction)');
        }, 100);
        
        setTimeout(() => {
          cwethBalance.forceRefresh();
          console.log('🔄 First refresh triggered (500ms after transaction)');
        }, 500);
        
        setTimeout(() => {
          cwethBalance.forceRefresh();
          console.log('🔄 Second refresh triggered (1s after transaction)');
        }, 1000);
        
        setTimeout(() => {
          cwethBalance.forceRefresh();
          console.log('🔄 Third refresh triggered (2s after transaction)');
        }, 2000);
        
        setTimeout(() => {
          cwethBalance.forceRefresh();
          console.log('🔄 Fourth refresh triggered (3s after transaction)');
        }, 3000);
        
        } catch (unwrapError: any) {
          console.error('❌ Unwrap transaction failed:', unwrapError);
          throw unwrapError; // Re-throw to be caught by outer catch block
        }
        
      } else {
        // ERC20 → Confidential Token (wrap)
        console.log('📦 Starting wrap process...');
        
        try {
        
        // First check allowance and approve if necessary
        const allowance = await readContract(config, {
          address: erc20Address as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'allowance',
          args: [address, swapperAddress],
        });
        
        if (allowance < amountNative) {
          console.log('Approving ERC20 tokens...');
          const approveHash = await writeContractAsync({
            address: erc20Address as `0x${string}`,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [swapperAddress, amountNative],
          });
          console.log('Approval transaction:', approveHash);
          await waitForTransactionReceipt(config, { hash: approveHash });
          console.log('Approval successful.');
        }

        // Call the ConfidentialTokenSwapper wrap function
        const result = await writeSwapContract({
          address: swapperAddress as `0x${string}`,
          abi: TOKEN_SWAPPER_ABI,
          functionName: 'swapERC20ToConfidential',
          args: [erc20Address, amountNative, address],
        });
        console.log('✅ Wrap transaction submitted successfully:', result);
        
        // Start aggressive refresh immediately after wrap transaction submission
        console.log('🔄 Starting aggressive balance refresh after wrap transaction...');
        
        // Immediate refresh
        setTimeout(() => {
          cwethBalance.forceRefresh();
          cusdcBalance.forceRefresh();
          console.log('🔄 Immediate refresh triggered (100ms after wrap transaction)');
        }, 100);
        
        setTimeout(() => {
          cwethBalance.forceRefresh();
          cusdcBalance.forceRefresh();
          console.log('🔄 First refresh triggered (500ms after wrap transaction)');
        }, 500);
        
        setTimeout(() => {
          cwethBalance.forceRefresh();
          cusdcBalance.forceRefresh();
          console.log('🔄 Second refresh triggered (1s after wrap transaction)');
        }, 1000);
        
        setTimeout(() => {
          cwethBalance.forceRefresh();
          cusdcBalance.forceRefresh();
          console.log('🔄 Third refresh triggered (2s after wrap transaction)');
        }, 2000);
        
        setTimeout(() => {
          cwethBalance.forceRefresh();
          cusdcBalance.forceRefresh();
          console.log('🔄 Fourth refresh triggered (3s after wrap transaction)');
        }, 3000);
        
        } catch (wrapError: any) {
          console.error('❌ Wrap transaction failed:', wrapError);
          throw wrapError; // Re-throw to be caught by outer catch block
        }
      }
    } catch (err: any) {
      console.error('❌ Swap failed:', err);
      setSwapTransactionError(err.shortMessage || err.message || 'Swap failed');
    } finally {
      setIsSwapping(false);
    }
  };

  const handleMaxAmount = () => {
    if (!isReversed) {
      // For forward swaps (ERC20 → Confidential), use ERC20 balance
      if (selectedToken === 'WETH' && wethBalance && Number(wethBalance) > 0) {
        const wethAmount = Number(wethBalance) / 1e18;
        setSwapAmount((wethAmount * 0.95).toString()); // Leave some for gas
      } else if (selectedToken === 'USDC' && usdcBalance && Number(usdcBalance) > 0) {
        const usdcAmount = Number(usdcBalance) / 1e6;
        setSwapAmount((usdcAmount * 0.95).toString()); // Leave some for gas
      } else if (selectedToken === 'DAI' && daiBalance && Number(daiBalance) > 0) {
        const daiAmount = Number(daiBalance) / 1e18;
        setSwapAmount((daiAmount * 0.95).toString()); // Leave some for gas
      } else {
        setSwapAmount('0');
      }
    } else if (isReversed) {
      // For reverse swaps (Confidential → ERC20)
      if (selectedToken === 'WETH') {
        if (!cwethBalance.hasConfidentialToken) {
        setSwapAmount('0');
        } else if (cwethBalance.isDecrypted && cwethBalance.hasConfidentialToken) {
          const confidentialAmount = parseFloat(cwethBalance.formattedBalance.replace(' cWETH', ''));
          setSwapAmount(confidentialAmount.toString());
      } else {
          // User has confidential tokens but it's encrypted - can't set max amount
          setSwapAmount('0');
        }
      } else if (selectedToken === 'USDC') {
        if (!cusdcBalance.hasConfidentialToken) {
          setSwapAmount('0');
        } else if (cusdcBalance.isDecrypted && cusdcBalance.hasConfidentialToken) {
          const confidentialAmount = parseFloat(cusdcBalance.formattedBalance.replace(' cUSDC', ''));
          setSwapAmount(confidentialAmount.toString());
        } else {
          // User has confidential tokens but it's encrypted - can't set max amount
          setSwapAmount('0');
        }
      } else if (selectedToken === 'DAI') {
        if (!cdaiBalance.hasConfidentialToken) {
          setSwapAmount('0');
        } else if (cdaiBalance.isDecrypted && cdaiBalance.hasConfidentialToken) {
          const confidentialAmount = parseFloat(cdaiBalance.formattedBalance.replace(' cDAI', ''));
          setSwapAmount(confidentialAmount.toString());
        } else {
          // User has confidential tokens but it's encrypted - can't set max amount
          setSwapAmount('0');
        }
      } else {
        setSwapAmount('0');
      }
    }
  };

  const handleSwapReversal = () => {
    setIsReversed(!isReversed);
    setSwapAmount(''); // Clear the amount when reversing
    setShowBalanceError(false); // Clear any balance error when reversing
  };

  const handleCloseSwapModal = () => {
    setShowSwapModal(false);
    setSwapAmount(''); // Clear the amount when closing
    setShowBalanceError(false); // Clear any balance error when closing
    setIsReversed(false); // Reset to forward swap
    // Clear all error and success states when closing modal
    setSwapTransactionError(null);
    setSwapUserCancelled(false);
    setSwapSuccess(false);
    setIsSwapCompleted(false); // Reset completion state when closing modal
  };

  const handleNetworkSelect = (networkName: string) => {
    const network = availableNetworks.find(n => n.name === networkName);
    if (network && network.functional) {
      setSelectedNetwork(networkName);
      setShowNetworkDropdown(false);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Don't close if clicking inside the mobile menu
      if (showMobileMenu && target.closest('[data-mobile-menu]')) {
        return;
      }
      
      if (showNetworkDropdown) {
        setShowNetworkDropdown(false);
      }
      if (showMobileMenu) {
        setShowMobileMenu(false);
      }
    };

    // Only run in browser environment to avoid hydration issues
    if (typeof document !== 'undefined' && (showNetworkDropdown || showMobileMenu)) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('mousedown', handleClickOutside);
      }
    };
  }, [showNetworkDropdown, showMobileMenu]);

  const handleAmountChange = (value: string) => {
    setSwapAmount(value);
    
    // Check if amount exceeds balance for forward swaps (ERC20 → Confidential)
    if (!isReversed && value && parseFloat(value) > 0) {
      if (selectedToken === 'WETH' && wethBalance && parseFloat(value) > (Number(wethBalance) / 1e18)) {
        setShowBalanceError(true);
      } else if (selectedToken === 'USDC' && usdcBalance && parseFloat(value) > (Number(usdcBalance) / 1e6)) {
        setShowBalanceError(true);
      } else if (selectedToken === 'DAI' && daiBalance && parseFloat(value) > (Number(daiBalance) / 1e18)) {
        setShowBalanceError(true);
      } else {
        setShowBalanceError(false);
      } 
    } 
    // Check if amount exceeds confidential token balance for reverse swaps (Confidential → ERC20)
    else if (isReversed && value && parseFloat(value) > 0) {
      if (selectedToken === 'WETH') {
        if (!cwethBalance.hasConfidentialToken) {
        setShowBalanceError(true);
        } else if (cwethBalance.isDecrypted && cwethBalance.hasConfidentialToken) {
          const confidentialAmount = parseFloat(cwethBalance.formattedBalance.replace(' cWETH', ''));
          if (parseFloat(value) > confidentialAmount) {
      setShowBalanceError(true);
        } else {
          setShowBalanceError(false);
        }
      } else {
          // User has confidential tokens but it's encrypted - can't validate amount
          setShowBalanceError(false);
        }
      } else if (selectedToken === 'USDC') {
        if (!cusdcBalance.hasConfidentialToken) {
        setShowBalanceError(true);
        } else if (cusdcBalance.isDecrypted && cusdcBalance.hasConfidentialToken) {
          const confidentialAmount = parseFloat(cusdcBalance.formattedBalance.replace(' cUSDC', ''));
          if (parseFloat(value) > confidentialAmount) {
            setShowBalanceError(true);
          } else {
            setShowBalanceError(false);
          }
        } else {
          // User has confidential tokens but it's encrypted - can't validate amount
          setShowBalanceError(false);
        }
      } else if (selectedToken === 'DAI') {
        if (!cdaiBalance.hasConfidentialToken) {
          setShowBalanceError(true);
        } else if (cdaiBalance.isDecrypted && cdaiBalance.hasConfidentialToken) {
          const confidentialAmount = parseFloat(cdaiBalance.formattedBalance.replace(' cDAI', ''));
          if (parseFloat(value) > confidentialAmount) {
            setShowBalanceError(true);
          } else {
            setShowBalanceError(false);
          }
        } else {
          // User has confidential tokens but it's encrypted - can't validate amount
          setShowBalanceError(false);
        }
      } else {
        setShowBalanceError(false);
      }
    } else {
      setShowBalanceError(false);
    }
  };
 
  const getReverseSwapErrorMessage = useCallback((): string => {
    if (selectedToken === 'WETH') {
      if (!cwethBalance.hasConfidentialToken) return 'You have no cWETH to swap';
      if (cwethBalance.isDecrypted && cwethBalance.hasConfidentialToken) {
        const confidentialAmount = parseFloat(cwethBalance.formattedBalance.replace(' cWETH', ''));
        return `Amount exceeds your balance of ${confidentialAmount.toFixed(4)} cWETH`;
      }
      return 'Please decrypt your cWETH balance first to check available amount';
    } else if (selectedToken === 'USDC') {
      if (!cusdcBalance.hasConfidentialToken) return 'You have no cUSDC to swap';
      if (cusdcBalance.isDecrypted && cusdcBalance.hasConfidentialToken) {
        const confidentialAmount = parseFloat(cusdcBalance.formattedBalance.replace(' cUSDC', ''));
        return `Amount exceeds your balance of ${confidentialAmount.toFixed(4)} cUSDC`;
      }
      return 'Please decrypt your cUSDC balance first to check available amount';
    } else if (selectedToken === 'DAI') {
      if (!cdaiBalance.hasConfidentialToken) return 'You have no cDAI to swap';
      if (cdaiBalance.isDecrypted && cdaiBalance.hasConfidentialToken) {
        const confidentialAmount = parseFloat(cdaiBalance.formattedBalance.replace(' cDAI', ''));
        return `Amount exceeds your balance of ${confidentialAmount.toFixed(4)} cDAI`;
      }
      return 'Please decrypt your cDAI balance first to check available amount';
    }
    return 'You have no confidential tokens to swap';
  }, [selectedToken, cwethBalance, cusdcBalance, cdaiBalance]);
 
  // Prevent hydration mismatch - only render after mount
  if (!isMounted) {
    return <></>;
  }
 
  return (
    <>
      {/* Notification Banner */}
      {showNotificationBanner && (
        <Box sx={{ 
          background: isDarkMode 
            ? 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)'
            : 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)',
          color: 'white',
          py: 1,
          textAlign: 'center',
          borderBottom: isDarkMode 
            ? '1px solid rgba(255, 255, 255, 0.1)'
            : '1px solid rgba(255, 255, 255, 0.2)',
          position: 'relative'
        }}>
          <Typography variant="h6" sx={{ 
                        fontWeight: '600',
            fontSize: '1rem',
            letterSpacing: '0.5px'
          }}>
            Nexora - The Next Confidential Lending Protocol
          </Typography>
          <IconButton
            onClick={() => setShowNotificationBanner(false)}
            sx={{
              position: 'absolute',
              right: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'white',
              '&:hover': {
                backgroundColor: isDarkMode 
                  ? 'rgba(255, 255, 255, 0.1)'
                  : 'rgba(255, 255, 255, 0.2)'
              }
            }}
            size="small"
          >
            <Close />
          </IconButton>
        </Box>
      )}

      <AppBar position="static" sx={{ 
        background: isDarkMode 
          ? 'linear-gradient(135deg, #191919 0%, #191919 0%)'
          : 'linear-gradient(135deg, #ffffff3a 0%, #e6ded4de 0%)',
        boxShadow: isDarkMode 
          ? '0 2px 8px rgba(15, 15, 15, 0.98)'
          : '0 2px 8px rgba(15, 15, 15, 0.98)',
        color: isDarkMode ? 'white' : '#000000'
      }}>
        <Toolbar sx={{ 
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          py: 0,
          px: { xs: 2, sm: 3 }
        }}>
          {/* Left Side: Logo + Vertical Menu */}
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center',
            gap: { xs: 0.5, sm: 1 }
          }}>
            {/* Logo */}
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography 
                variant="h6" 
                component="div" 
                sx={{ 
                  fontWeight: isDarkMode ? '800' : '500',
                  fontSize: { xs: '1.1rem', sm: '1.5rem' },
                  letterSpacing: '-0.02em',
                  fontFamily: 'sans-serif',
                  background: isDarkMode 
                    ? 'linear-gradient(135deg, #ffffff 0%, #8a9ba8 50%, #ffffff 100%)'
                    : 'linear-gradient(135deg, #2c3e50 0%, #34495e 50%, #2c3e50 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  textShadow: isDarkMode 
                    ? '0 0 20px rgba(255, 255, 255, 0.3)'
                    : '0 0 20px rgba(44, 62, 80, 0.3)',
                  position: 'relative',
                  '&::after': {
                    content: '""',
                    position: 'absolute',
                    bottom: '-2px',
                    left: 0,
                    right: 0,
                    height: '2px',
                    background: isDarkMode 
                      ? 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.4) 50%, transparent 100%)'
                      : 'linear-gradient(90deg, transparent 0%, rgba(44, 62, 80, 0.4) 50%, transparent 100%)',
                    borderRadius: '1px'
                  }
                }}
              >
                Nexora
              </Typography>
            </Box>

            {/* Hamburger Menu - Dynamic based on available space */}
            <Box sx={{ 
              display: useVerticalNav ? 'block' : 'none',
              position: 'relative'
            }}>
              <IconButton
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                sx={{
                  color: isDarkMode ? 'white' : '#000000',
                  p: 0.5,
                  '&:hover': {
                    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                  }
                }}
              >
                <Box sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  width: '16px',
                  height: '12px'
                }}>
                  <Box sx={{
                    width: '100%',
                    height: '2px',
                    backgroundColor: 'currentColor',
                    borderRadius: '1px'
                  }} />
                  <Box sx={{
                    width: '100%',
                    height: '2px',
                    backgroundColor: 'currentColor',
                    borderRadius: '1px'
                  }} />
                  <Box sx={{
                    width: '100%',
                    height: '2px',
                    backgroundColor: 'currentColor',
                    borderRadius: '1px'
                  }} />
                </Box>
              </IconButton>

              {/* Mobile Menu Dropdown */}
              {showMobileMenu && (
                <Box 
                  data-mobile-menu
                  sx={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  mt: 1,
                  minWidth: '120px',
                  background: isDarkMode 
                    ? 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)'
                    : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                  border: isDarkMode 
                    ? '1px solid rgba(255, 255, 255, 0.1)'
                    : '1px solid rgba(44, 62, 80, 0.1)',
                  borderRadius: '4px',
                  boxShadow: isDarkMode 
                    ? '0 8px 32px rgba(0, 0, 0, 0.3)'
                    : '0 8px 32px rgba(0, 0, 0, 0.1)',
                  zIndex: 1000,
                  overflow: 'hidden'
                }}>
                  {navigationTabs.map((tab) => (
                    <Button
                      key={tab}
                      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setActiveTab(tab);
                        setShowMobileMenu(false);
                      }}
                      sx={{
                        width: '100%',
                        py: 1,
                        px: 2,
                        fontSize: '0.8rem',
                        fontWeight: activeTab === tab ? '600' : '400',
                        color: activeTab === tab 
                          ? (isDarkMode ? 'white' : '#000000')
                          : (isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)'),
                        backgroundColor: activeTab === tab 
                          ? (isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)')
                          : 'transparent',
                        borderRadius: 0,
                        textTransform: 'capitalize',
                        justifyContent: 'flex-start',
                        '&:hover': {
                          backgroundColor: activeTab === tab 
                            ? (isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)')
                            : (isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)')
                        }
                      }}
                    >
                      {tab}
                    </Button>
                  ))}
                </Box>
              )}
            </Box>
          </Box>

          {/* Desktop Navigation Tabs */}
          <Box sx={{ 
            flexGrow: 1,
            display: useVerticalNav ? 'none' : 'block'
          }}>
            <Tabs
              value={activeTab}
              onChange={(_: React.SyntheticEvent, newValue: any) => setActiveTab(newValue as 'dashboard' | 'markets' | 'portfolio')}
              textColor="inherit"
              indicatorColor="secondary"
              sx={{
                '& .MuiTab-root': {
                  color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
                  fontWeight: '500',
                  textTransform: 'none',
                  fontSize: '0.875rem',
                  minHeight: '48px',
                  '&.Mui-selected': {
                    color: isDarkMode ? 'white' : '#000000',
                    fontWeight: '600'
                  },
                  '&:hover': {
                    color: isDarkMode ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)'
                  }
                },
                '& .MuiTabs-indicator': {
                  backgroundColor: isDarkMode ? 'white' : '#000000',
                  height: '2px'
                }
              }}
            >
              <Tab label="Dashboard" value="dashboard" />
              <Tab label="Markets" value="markets" />
              <Tab label="Portfolio" value="portfolio" />
            </Tabs>
          </Box>

          {/* Right Side Controls */}
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: { xs: 0.5, sm: 1.5 },
            minWidth: 0 // Prevent overflow
          }}>
          {isConnected ? (
              <>
                {/* Network Selector */}
                <Box sx={{ position: 'relative' }}>
                <Button
                  variant="outlined"
                  size="small"
                    endIcon={<ExpandMore />}
                    onClick={() => setShowNetworkDropdown(!showNetworkDropdown)}
                    sx={{
                      background: isDarkMode 
                      ? 'linear-gradient(135deg, #34495e 0%, #14171aff  0%)'
                      : 'linear-gradient(135deg, #5e6061ff 0%, #e6ded4de  0%)',
                      border: isDarkMode 
                          ? '1px solid rgba(255, 255, 255, 0.3)'
                          : '1px solid rgba(3, 24, 37, 0.94)',
                      color: isDarkMode ? 'white' : '#000000',borderRadius: '0px',
                      minWidth: { xs: '40px', sm: '120px', md: 'auto' },
                      width: { xs: '40px', sm: '120px', md: 'auto' },height: '34px',
                      px: { xs: 0.5, sm: 1.5 },
                      pl: { xs: 0.5, sm: 1.5 },
                      fontSize: { xs: '0.7rem', sm: '0.75rem' },
                      '&:hover': {
                        borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.5)' : 'rgba(44, 62, 80, 0.5)',
                        background: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(44, 62, 80, 0.1)'
                      }
                    }}
                  >
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center',
                      marginRight: { xs: '0px', sm: '8px' }
                    }}>
                      <img 
                        src={availableNetworks.find(n => n.name === selectedNetwork)?.icon} 
                        alt={selectedNetwork}
                        style={{ 
                          width: '16px', 
                          height: '16px'
                        }}
                      />
                    </Box>
                    <Box sx={{ display: { xs: 'none', sm: 'inline' } }}>
                      {selectedNetwork}
                    </Box>
                </Button>
                  
                  {/* Network Dropdown */}
                  {showNetworkDropdown && (
                    <Box sx={{
                      position: 'absolute',
                      top: '100%',
                      left: { xs: 'auto', sm: 0 },
                      right: { xs: 0, sm: 0 },
                      mt: 1,
                      minWidth: { xs: '160px', sm: 'auto' },
                      maxWidth: { xs: '180px', sm: '200px' },
                      maxHeight: '150px',
                      background: isDarkMode 
                        ? 'linear-gradient(135deg, #2c3e50 0%,#1f2325ff 0%)'
                        : 'linear-gradient(135deg, #e6ded4de  0%, #e6ded4de 0%)',
                      border: isDarkMode 
                        ? '1px solid rgba(255, 255, 255, 0.1)'
                        : '1px solid rgba(44, 62, 80, 0.1)',
                      borderRadius: '0px',
                      boxShadow: isDarkMode 
                        ? '0 8px 32px rgba(10, 8, 8, 0.96)'
                        : '0 8px 32px rgba(0, 0, 0, 0.1)',
                      zIndex: 1000,
                      overflowY: 'auto',
                      overflowX: 'hidden',
                      '&::-webkit-scrollbar': {
                        width: '6px',
                      },
                      '&::-webkit-scrollbar-track': {
                        background: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(44, 62, 80, 0.1)',
                        borderRadius: '3px',
                      },
                      '&::-webkit-scrollbar-thumb': {
                        background: isDarkMode ? 'rgba(255, 255, 255, 0.3)' : 'rgba(44, 62, 80, 0.3)',
                        borderRadius: '3px',
                      },
                      '&::-webkit-scrollbar-thumb:hover': {
                        background: isDarkMode ? 'rgba(255, 255, 255, 0.5)' : 'rgba(44, 62, 80, 0.5)',
                      }
                    }}>
                      {availableNetworks.map((network) => (
                        <Box
                          key={network.name}
                          onClick={() => handleNetworkSelect(network.name)}
                          sx={{
                            px: 1.5,
                            py: 1,
                            cursor: network.functional ? 'pointer' : 'not-allowed',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.75,
                            color: network.functional 
                              ? (isDarkMode ? 'white' : '#000000')
                              : (isDarkMode ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)'),
                            fontSize: '0.75rem',
                            fontWeight: network.name === selectedNetwork ? '600' : '400',
                            background: network.name === selectedNetwork 
                              ? (isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)')
                              : 'transparent',
                            '&:hover': network.functional ? {
                              background: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(44, 62, 80, 0.05)'
                            } : {},
                            borderBottom: '1px solid',
                            borderBottomColor: isDarkMode 
                              ? 'rgba(255, 255, 255, 0.05)'
                              : 'rgba(0, 0, 0, 0.05)'
                          }}
                        >
                          <img 
                            src={network.icon} 
                            alt={network.name}
                            style={{ width: '14px', height: '14px' }}
                          />
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="body2" sx={{ 
                              fontWeight: 'inherit',
                              fontSize: 'inherit',
                              color: 'inherit'
                            }}>
                              {network.name}
              </Typography>
                            <Typography variant="caption" sx={{ 
                              color: isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)',
                              fontSize: '0.65rem'
                            }}>
                              {network.functional ? 'Available' : 'Coming Soon'}
                            </Typography>
                          </Box>
                          {network.name === selectedNetwork && (
                            <Box sx={{ 
                              width: 6, 
                              height: 6, 
                              borderRadius: '0px', 
                              background: '#0cf513ff' ,
                              boxShadow: '0 0 6px rgba(21, 231, 28, 1)'
                            }} />
                          )}
                        </Box>
                      ))}
                    </Box>
                  )}
                </Box>

                {/* Lock/Unlock Icon with Status */}
                {canMasterDecrypt && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <IconButton
                      onClick={isAllDecrypted ? lockAllBalances : unlockAllBalances}
                      disabled={isMasterDecrypting}
                      sx={{
                        width: '34px',
                        height: '34px',
                        background: isDarkMode 
                          ? 'linear-gradient(135deg, #34495e 0%, #14171aff  0%)'
                          : 'linear-gradient(135deg, #5e6061ff 0%, #e6ded4de  0%)',
                        color: isAllDecrypted 
                          ? (isDarkMode ? '#f01d05ff' : '#c0392b') // Red for unlock (can lock)
                          : (isDarkMode ? '#11d817ff' : '#2ecc71'), // Green for lock (can unlock)
                        border: isDarkMode 
                          ? '1px solid rgba(255, 255, 255, 0.3)'
                          : '1px solid rgba(3, 24, 37, 0.94)',
                        borderRadius: '0px',
                        boxShadow: isDarkMode 
                          ? '0 4px 14px 0 rgba(13, 13, 14, 0.95)'
                          : '0 4px 14px 0 rgba(52, 152, 219, 0.3)',
                        '&:hover': {
                          background: isDarkMode 
                            ? 'rgba(255, 255, 255, 0.15)'
                            : 'rgba(44, 62, 80, 0.15)'
                        },
                        '&:disabled': {
                          opacity: 0.6,
                          cursor: 'not-allowed'
                        },
                        transition: 'all 0.3s ease'
                      }}
                      title={isAllDecrypted ? 'Lock all balances' : 'Unlock all balances'}
                    >
                      {isMasterDecrypting ? (
                        <CircularProgress size={16} sx={{ color: 'inherit' }} />
                      ) : isAllDecrypted ? (
                        <LockOpen sx={{ fontSize: '16px' }} />
                      ) : (
                        <Lock sx={{ fontSize: '16px' }} />
                      )}
                    </IconButton>
                    
                    {/* Status Indicator */}
                    <Box sx={{ 
                      width: '6px', 
                      height: '6px', 
                      borderRadius: '0px', 
                      background: isAllDecrypted 
                        ? (isDarkMode ? '#11d817ff' : '#2ecc71') // Green when unlocked
                        : (isDarkMode ? '#fa061aff' : '#f1260fff'), // Red when locked
                      opacity: isMasterDecrypting ? 0.5 : 1,
                      transition: 'all 0.3s ease'
                    }} 
                    title={isAllDecrypted ? 'Balances unlocked' : 'Balances locked'}
                    />
                    
                  </Box>
                )}
              
                {/* Swap Button */}
              <Button
                variant="outlined"
                size="small"
                  onClick={() => setShowSwapModal(true)}
                  sx={{
                    background: isDarkMode 
                      ? 'linear-gradient(135deg, #34495e 0%, #14171aff 0%)'
                      : 'linear-gradient(135deg, #5e6061ff 0%, #e6ded4de  0%)',
                    color: isDarkMode ? 'white' : '#000000',
                    
                    px: { xs: 2, sm: 3 },height: '34px', borderRadius: '0px',
                    textTransform: 'none',
                    fontSize: { xs: '0.7rem', sm: '0.75rem' },
                    boxShadow: isDarkMode 
                        ? '0 4px 14px 0 rgba(5, 6, 7, 0.96)'
                        : '0 4px 14px 0 rgba(52, 152, 219, 0.3)',
                    border: isDarkMode 
                        ? '1px solid rgba(255, 255, 255, 0.3)'
                        : '1px solid rgba(3, 24, 37, 0.94)',
                    '&:hover': {
                      background: isDarkMode 
                        ? 'rgba(255, 255, 255, 0.15)'
                        : 'rgba(44, 62, 80, 0.15)'
                    },
                    
                  }}
                >
                  Swap
              </Button>

                {/* Wallet Address Display */}
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 1,
                  height: '34px',
                  background: isDarkMode 
                    ? 'linear-gradient(135deg, #34495e 0%, #14171aff  0%)'
                    : 'linear-gradient(135deg, #5e6061ff 0%, #e6ded4de  0%)',
                  boxShadow: isDarkMode 
                      ? '0 4px 14px 0 rgba(5, 6, 7, 0.96)'
                      : '0 4px 14px 0 rgba(52, 152, 219, 0.3)',
                  border: isDarkMode 
                      ? '1px solid rgba(255, 255, 255, 0.3)'
                      : '1px solid rgba(3, 24, 37, 0.94)',
                  borderRadius: '0px',
                  px: { xs: 1, sm: 2 },
                  py: { xs: 0.5, sm: 1 },
                  cursor: 'pointer',
                  fontSize: { xs: '0.7rem', sm: '0.75rem' },
                  '&:hover': {
                    background: isDarkMode 
                      ? 'rgba(255, 255, 255, 0.15)'
                      : 'rgba(44, 62, 80, 0.15)'
                  }
                }}
                onClick={handleWalletInfoClick}>
                  <Box sx={{ 
                    width: 6, 
                    height: 6, 
                    borderRadius: '0px', 
                    background: '#11d817ff',
                    boxShadow: '0 0 6px rgba(21, 231, 28, 1)'
                  }} />
                  <Typography variant="body2" sx={{ 
                    fontWeight: '500',
                    fontSize: { xs: '0.7rem', sm: '0.75rem' }
                  }}>
                    {address?.slice(0, 6)}...{address?.slice(-4)}
                  </Typography>
                  <ExpandMore sx={{ fontSize: { xs: 12, sm: 16 }, opacity: 0.7 }} />
            </Box>
              </>
          ) : (
            <ConnectKitButton.Custom>
              {({ isConnecting, show }) => (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={show}
                  sx={{
                    background: isDarkMode
                      ? 'linear-gradient(135deg, #34495e 0%, #14171a 100%)'
                      : 'linear-gradient(135deg, #3498db 0%, #e6ded4 100%)',
                    color: isDarkMode ? 'white' : '#000000',
                    fontWeight: 600,
                    px: { xs: 2, sm: 3 },
                    height: '34px',
                    borderRadius: '0px',
                    textTransform: 'none',
                    fontSize: { xs: '0.7rem', sm: '0.75rem' },
                    boxShadow: isDarkMode
                      ? '0 4px 14px 0 rgba(5, 6, 7, 0.96)'
                      : '0 4px 14px 0 rgba(52, 152, 219, 0.3)',
                    border: isDarkMode
                      ? '1px solid rgba(255, 255, 255, 0.3)'
                      : '1px solid rgba(52, 152, 219, 0.2)',
                    '&:hover': {
                      background: isDarkMode
                        ? 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)'
                        : 'linear-gradient(135deg, #2980b9 0%, #3498db 100%)',
                      boxShadow: isDarkMode
                        ? '0 6px 20px 0 rgba(52, 73, 94, 0.4)'
                        : '0 6px 20px 0 rgba(52, 152, 219, 0.4)',
                    },
                    transition: 'all 0.3s ease',
                  }}
                >
                  {isConnecting ? (
                    <>
                      <CircularProgress size={14} sx={{ mr: 1 }} />
                      Connecting...
                    </>
                  ) : (
                    'Connect Wallet'
                  )}
                </Button>
              )}
            </ConnectKitButton.Custom>
          )}
          </Box>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ 
        px: { xs: 2, sm: 3, md: 4 },
        background: isDarkMode 
          ? 'transparent'
          : 'linear-gradient(135deg, #F9FAFB 0%, #F9FAFB 0%)',
        minHeight: '100vh', // Use full viewport height
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Main Content Wrapper */}
        <Box sx={{ flex: 1, gap: 1, display: 'flex', flexDirection: 'column',
         //mt: 0.2, //margin-top
         pb: { xs: 2, sm: 3}  // padding-bottom
      }}>
          {/* Contract Status Banner */}
          <ContractStatusBanner isDarkMode={isDarkMode} />
          
          {/* Tab Content */}
          {activeTab === 'dashboard' && (
                  <Box>
            {/* Portfolio Overview Section */}
            <Card sx={{
              mb: { xs: 2, sm: 3 },
              background: isDarkMode
                ? 'linear-gradient(135deg, #34495e 0%,  #1f2325ff 0%)'
                : 'linear-gradient(135deg, #f5f7fa 0%, #e8ecf0 100%)',
              color: isDarkMode ? 'white' : '#000000',
              borderRadius: '0px',
              overflow: 'hidden',
              border: isDarkMode
                ? '1px solid rgba(255, 255, 255, 0.1)'
                : '1px solid rgba(44, 62, 80, 0.1)',
              boxShadow: isDarkMode
                ? '0 4px 20px rgba(0, 0, 0, 0.3)'
                : '0 4px 20px rgba(0, 0, 0, 0.1)'
            }}>
              <CardContent sx={{ p: { xs: 2, sm: 4 } }}>
                {/* User overview section (Net Worth, Total Supply, Total Borrow, Health Factor) */}
                <UserOverviewSection
                  suppliedBalances={suppliedBalancesMap}
                  borrowedBalances={borrowedBalances}
                  assets={supplyAssets}
                  isLoadingSupplied={isLoadingSupplied}
                  isLoadingBorrowed={isLoadingBorrowed}
                  isDarkMode={isDarkMode}
                  userCollateralEnabledBySymbol={userCollateralEnabledBySymbol}
                />

                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'flex-start', 
                  mb: { xs: 2, sm: 3 },
                  flexDirection: { xs: 'column', sm: 'row' }
                }}>
                  <Box>
                  </Box>
        </Box>

{/* additional  dashboard contents will be here*/}


              </CardContent>
            </Card>

            {/* Portfolio Positions - Combined Supplies and Borrows */}
            <Card sx={{
              mb: 2,
              background: isDarkMode
                ? 'linear-gradient(135deg, #011931ff 0%, #1f2325ff 0%)'
                : 'linear-gradient(135deg, #f5f7fa 0%, #e8ecf0 0%)',
              color: isDarkMode ? 'white' : '#000000',
              borderRadius: '0px',
              border: isDarkMode
                ? '1px solid rgba(255, 255, 255, 0.04)'
                : '1px solid rgba(44, 62, 80, 0.08)',
              boxShadow: isDarkMode
                ? '0 4px 20px rgba(0, 0, 0, 0.3)'
                : '0 4px 20px rgba(0, 0, 0, 0.04)'
            }}>
              <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 3, color: isDarkMode ? 'white' : '#000000' }}>Your Portfolio Positions</Typography>

                {/* Supplies Section */}
                <Box sx={{ mb: 4 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: isDarkMode ? 'white' : '#000000' }}>Your Supplies</Typography>
                  <UserSuppliesSection
                    suppliedBalances={suppliedBalancesMap}
                    assets={supplyAssets}
                    userCollateralEnabled={userCollateralEnabledBySymbol}
                    onWithdrawClick={handleWithdrawClick}
                    onCollateralToggle={(asset, enabled) => toggleCollateral(asset, enabled)}
                    hasActiveBorrowsForSymbol={hasActiveBorrowsForSymbol}
                    isLoadingSupplied={isLoadingSupplied}
                    isDarkMode={isDarkMode}
                    onNavigateToMarkets={handleNavigateToMarkets}
                  />
                </Box>

                {/* Borrows Section */}
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: isDarkMode ? 'white' : '#000000' }}>Your Borrows</Typography>
                  <UserBorrowsSection
                    borrowedBalances={borrowedBalances}
                    suppliedBalances={suppliedBalancesMap}
                    assets={supplyAssets}
                    userCollateralEnabled={userCollateralEnabledBySymbol}
                    onRepayClick={handleRepayClick}
                    isLoadingBorrowed={isLoadingBorrowed}
                    isDarkMode={isDarkMode}
                    onNavigateToMarkets={handleNavigateToMarkets}
                  />
                </Box>
              </CardContent>
            </Card>

            {/* Markets removed from Dashboard to keep it user-centric (moved to dedicated Markets tab) */}
          </Box>
        )}

        {/* Markets Tab */}
        {activeTab === 'markets' && (
          <Box>
            <Card sx={{
              mb: 2,
              background: isDarkMode
                ? 'linear-gradient(135deg, #011931ff 0%, #1f2325ff 0%)'
                : 'linear-gradient(135deg, #f5f7fa 0%, #e8ecf0 0%)',
              color: isDarkMode ? 'white' : '#000000',
              borderRadius: '0px',
              border: isDarkMode
                ? '1px solid rgba(255, 255, 255, 0.1)'
                : '1px solid rgba(44, 62, 80, 0.1)',
              boxShadow: isDarkMode
                ? '0 4px 20px rgba(0, 0, 0, 0.3)'
                : '0 4px 20px rgba(0, 0, 0, 0.1)'
            }}>
              <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
                <MarketsTab
                  assets={supplyAssets}
                  reserveTotals={totals}
                  suppliedBalances={suppliedBalancesMap}
                  borrowedBalances={borrowedBalances}
                  onSupplyClick={handleSupplyClick}
                  onBorrowClick={handleBorrowClick}
                  onDecryptTotals={handleDecryptAllTotals}
                  isDarkMode={isDarkMode}
                  isLoadingReserves={isLoadingReserves}
                  isDecryptingTotals={isDecryptingTotals}
                  userCollateralEnabledBySymbol={userCollateralEnabledBySymbol}
                />
              </CardContent>
            </Card>
          </Box>
        )}

        {/* Portfolio Tab */}
        {activeTab === 'portfolio' && (
          <Box>
            {/* Portfolio Header */}
            <Card sx={{
              mt:0.15, 
              mb: 3, 
              background: isDarkMode 
                ? 'linear-gradient(135deg,  #011931ff 0%, #1f2325ff 0%)'
                : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
              color: isDarkMode ? 'white' : '#000000',
              borderRadius: '0px',
              border: isDarkMode 
                ? '1px solid rgba(255, 255, 255, 0.1)'
                : '1px solid rgba(44, 62, 80, 0.1)',
              boxShadow: isDarkMode 
                ? '0 4px 20px rgba(0, 0, 0, 0.3)'
                : '0 4px 20px rgba(0, 0, 0, 0.1)'
            }}>
              <CardContent sx={{ p: 4 }}>
                {/* Portfolio Sub-tabs */}
                <Box sx={{ mb: 3 }}>
                  <Box sx={{ 
                    display: 'flex', 
                    borderBottom: 1, 
                    borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    mb: 3
                  }}>
                    <Button
                      onClick={() => setPortfolioSubTab('overview')}
                      sx={{
                        px: 3,
                        py: 1.5,
                        textTransform: 'none',
                        fontWeight: '600',
                        fontSize: '0.9rem',
                        color: portfolioSubTab === 'overview'
                          ? (isDarkMode ? 'white' : '#000000')
                          : (isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)'),
                        borderBottom: portfolioSubTab === 'overview' ? 2 : 0,
                        borderColor: '#2196f3',
                        borderRadius: 0,
                        '&:hover': {
                          background: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(44, 62, 80, 0.05)'
                        }
                      }}
                    >
                      Overview
                    </Button>
                    <Button
                      onClick={() => setPortfolioSubTab('history')}
                      sx={{
                        px: 3,
                        py: 1.5,
                        textTransform: 'none',
                        fontWeight: '600',
                        fontSize: '0.9rem',
                        color: portfolioSubTab === 'history'
                          ? (isDarkMode ? 'white' : '#000000')
                          : (isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)'),
                        borderBottom: portfolioSubTab === 'history' ? 2 : 0,
                        borderColor: '#2196f3',
                        borderRadius: 0,
                        '&:hover': {
                          background: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(44, 62, 80, 0.05)'
                        }
                      }}
                    >
                      History
                    </Button>
                  </Box>
                </Box>
                
                {/* Portfolio Overview Content */}
                {portfolioSubTab === 'overview' && (
                  <>
                    {/* Portfolio Analytics */}
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="h6" sx={{ fontWeight: 600, mb: 3, color: isDarkMode ? 'white' : '#000000' }}>Portfolio Analytics</Typography>
                      <Grid container spacing={{ xs: 2, sm: 3, md: 3 }} sx={{ mb: 4 }}>
                        <Grid item xs={12}>
                          <Tooltip title="Total number of active supply and borrow positions" arrow placement="top">
                            <Card sx={{ p: { xs: 2, sm: 3 }, borderRadius: '8px', background: isDarkMode ? 'linear-gradient(135deg, rgba(139,92,246,0.06) 0%, rgba(139,92,246,0.02) 100%)' : 'linear-gradient(135deg, rgba(139,92,246,0.03) 0%, rgba(139,92,246,0.01) 100%)', border: `2px solid ${isDarkMode ? 'rgba(139,92,246,0.12)' : 'rgba(139,92,246,0.08)'}`, '&:hover': { transform: 'scale(1.02)', transition: 'all 0.3s ease' } }}>
                              <Box display="flex" alignItems="center" gap={2}>
                               
                                <Box>
                                  <Typography variant="body2" sx={{ opacity: isDarkMode ? 0.9 : 0.8 }}>Active Positions</Typography>
                                  <Typography variant="h4" sx={{ fontWeight: 600 }}>{activePositionsCount}</Typography>
                                  <Typography variant="caption" sx={{ opacity: 0.6 }}>Supply + Borrow</Typography>
                                </Box>
                              </Box>
                            </Card>
                          </Tooltip>
                        </Grid>
                      </Grid>
                    </Box>

                  <Box  display="flex">
                    {/* Asset Breakdown - Dynamic list of wallet confidential tokens */}
                    <WalletAssetBreakdown
                      availableAssets={availableWalletAssets}
                      masterSignature={masterSignature}
                      getMasterSignature={getMasterSignature}
                      isDarkMode={isDarkMode}
                    />


                    <Card sx={{
                      flexGrow: 1,
                      width: '50%',
                      mb: 1,
                      background: isDarkMode 
                        ? 'rgba(255, 255, 255, 0.08)'
                        : 'rgba(44, 62, 80, 0.08)',
                      border: isDarkMode 
                        ? '2px solid rgba(255, 255, 255, 0.2)'
                        : '2px solid rgba(44, 62, 80, 0.3)',
                      boxShadow: isDarkMode 
                        ? '0 2px 8px rgba(0, 0, 0, 0.2)'
                        : '0 2px 8px rgba(44, 62, 80, 0.1)'
                    }}>
                    </Card>
                  </Box>
                  </>
                )}
                
                {/* Transaction History Content */}
                {portfolioSubTab === 'history' && (
                  <TransactionHistoryTable isDarkMode={isDarkMode} />
                )}
              </CardContent>
            </Card>
          </Box>
        )}
        </Box>

        {/* Footer */}
        <Box sx={{ 
          mt: 4,
          borderTop: '1px solid #e0e0e0'
        }}>
          <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3 }, py: 3 }}>
            <Grid container spacing={2} alignItems="center">
              {/* Links Section */}
              <Grid item xs={12} md={8}>
                <Box sx={{ 
                  display: 'flex', 
                  flexWrap: 'wrap', 
                  gap: 1.5,
                  justifyContent: { xs: 'center', md: 'flex-start' }
                }}>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      '&:hover': {
                        color: isDarkMode ? 'white' : '#000000'
                      }
                    }}
                  >
                    Terms
                  </Typography>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      '&:hover': {
                        color: isDarkMode ? 'white' : '#000000'
                      }
                    }}
                  >
                    Privacy
                  </Typography>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      '&:hover': {
                        color: isDarkMode ? 'white' : '#000000'
                      }
                    }}
                  >
                    Docs
                  </Typography>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      '&:hover': {
                        color: isDarkMode ? 'white' : '#000000'
                      }
                    }}
                  >
                    FAQs
                  </Typography>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      '&:hover': {
                        color: isDarkMode ? 'white' : '#000000'
                      }
                    }}
                  >
                    Support
                  </Typography>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: isDarkMode ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)',
                      fontSize: '0.75rem',
                      ml: 2
                    }}
                  >
                    © 2025
                  </Typography>
                </Box>
              </Grid>

              {/* Social Media Icons */}
              <Grid item xs={12} md={4}>
                <Box sx={{ 
                  display: 'flex', 
                  gap: 1,
                  justifyContent: { xs: 'center', md: 'flex-end' }
                }}>
                  <IconButton
                    sx={{
                      p: 0.5,
                      '&:hover': {
                        background: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                        transform: 'scale(1.1)'
                      },
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <img 
                      src="/assets/icons/telegram.svg" 
                      alt="Telegram"
                      style={{ width: '16px', height: '16px' }}
                    />
                  </IconButton>
                  <IconButton
                    sx={{
                      p: 1,
                      '&:hover': {
                        background: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                        transform: 'scale(1.1)'
                      },
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <img 
                      src="/assets/icons/discord.svg" 
                      alt="Discord"
                      style={{ width: '16px', height: '16px' }}
                    />
                  </IconButton>
                  <IconButton
                    sx={{
                      p: 1,
                      '&:hover': {
                        background: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                        transform: 'scale(1.1)'
                      },
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <img 
                      src="/assets/icons/refinedgithub.svg" 
                      alt="GitHub"
                      style={{ width: '16px', height: '16px' }}
                    />
                  </IconButton>
                  <IconButton
                    sx={{
                      p: 1,
                      '&:hover': {
                        background: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                        transform: 'scale(1.1)'
                      },
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <img 
                      src="/assets/icons/x.svg" 
                      alt="X (Twitter)"
                      style={{ width: '16px', height: '16px' }}
                    />
                  </IconButton>
                </Box>
          </Grid>
        </Grid>
      </Container>
        </Box>

      </Container>


      {/* Swap - Fullscreen */}
      {showSwapModal && (
        <Box 
          className={styles.overlayBackdrop} 
          onClick={handleCloseSwapModal}
          sx={{
            '--swap-backdrop-bg': isDarkMode ? 'rgba(0, 0, 0, 0.25)' : 'rgba(0, 0, 0, 0.15)',
            '--swap-panel-bg': isDarkMode 
              ? 'linear-gradient(135deg, #2c3e50 0%, #1f2325ff 0%, #1f2325ff 0%)'
              : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 0%, #ffffff 0%)',
            '--swap-panel-border': isDarkMode 
              ? '1px solid rgba(255, 255, 255, 0.1)'
              : '1px solid rgba(44, 62, 80, 0.1)',
            '--swap-panel-shadow': isDarkMode 
              ? '0 16px 36px rgba(0, 0, 0, 0.7)'
              : '0 16px 36px rgba(0, 0, 0, 0.1)',
            '--swap-panel-text': isDarkMode ? '#fff' : '#000000',
            '--swap-header-border': isDarkMode 
              ? '1px solid rgba(255, 255, 255, 0.1)'
              : '1px solid rgba(44, 62, 80, 0.1)',
            '--swap-title-gradient': isDarkMode 
              ? 'linear-gradient(45deg, #ecf0f1, #bdc3c7)'
              : 'linear-gradient(45deg, #2c3e50, #34495e)',
            '--swap-token-bg': isDarkMode 
              ? 'linear-gradient(135deg, #1f2325ff 0%, #1f2325ff 0%)'
              : 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
            '--swap-token-border': isDarkMode 
              ? '1px solid rgba(255, 255, 255, 0.1)'
              : '1px solid rgba(44, 62, 80, 0.1)',
            '--swap-input-bg': isDarkMode 
              ? 'rgba(255, 255, 255, 0.06)'
              : 'rgba(44, 62, 80, 0.06)',
            '--swap-input-border': isDarkMode 
              ? '1px solid rgba(255, 255, 255, 0.15)'
              : '1px solid rgba(44, 62, 80, 0.15)',
            '--swap-input-shadow': isDarkMode 
              ? '0 2px 10px rgba(0, 0, 0, 0.15) inset'
              : '0 2px 10px rgba(0, 0, 0, 0.05) inset',
            '--swap-input-text': isDarkMode ? '#fff' : '#000000',
            '--swap-input-weight': isDarkMode ? '800' : '400',
            '--swap-amount-bg': isDarkMode 
              ? 'rgba(255, 255, 255, 0.08)'
              : 'rgba(44, 62, 80, 0.08)',
            '--swap-amount-border': isDarkMode 
              ? '1px solid rgba(255, 255, 255, 0.15)'
              : '1px solid rgba(44, 62, 80, 0.15)',
            '--swap-amount-text': isDarkMode ? '#fff' : '#000000',
            '--swap-details-bg': isDarkMode 
              ? 'linear-gradient(135deg, #1f2325ff 0%, #1f2325ff 0%)'
              : 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
            '--swap-details-border': isDarkMode 
              ? '1px solid rgba(255, 255, 255, 0.1)'
              : '1px solid rgba(44, 62, 80, 0.1)',
            '--swap-button-bg': isDarkMode 
              ? '#F5DCC6'
              : '#F5DCC6',
            '--swap-button-text': isDarkMode 
              ? 'rgba(0, 0, 0, 0.9)'
              : 'rgba(0, 0, 0, 0.9)',
            '--swap-readonly-text': isDarkMode 
              ? 'rgba(255, 255, 255, 0.8)'
              : 'rgba(0, 0, 0, 0.8)',
            '--swap-selector-bg': isDarkMode 
              ? 'rgba(255, 255, 255, 0.08)'
              : 'rgba(44, 62, 80, 0.08)',
            '--swap-selector-border': isDarkMode 
              ? '1px solid rgba(255, 255, 255, 0.2)'
              : '1px solid rgba(44, 62, 80, 0.2)',
            '--swap-selector-text': isDarkMode ? '#fff' : '#000000',
            '--swap-max-text': isDarkMode 
              ? 'rgba(255, 255, 255, 0.85)'
              : 'rgba(0, 0, 0, 0.85)',
            '--swap-max-bg': isDarkMode 
              ? 'rgba(255, 255, 255, 0.05)'
              : 'rgba(44, 62, 80, 0.05)',
            '--swap-max-border': isDarkMode 
              ? '1px solid rgba(255, 255, 255, 0.2)'
              : '1px solid rgba(44, 62, 80, 0.2)',
            '--swap-max-hover-bg': isDarkMode 
              ? 'rgba(255, 255, 255, 0.1)'
              : 'rgba(44, 62, 80, 0.1)',
            '--swap-approx-text': isDarkMode 
              ? 'rgba(255, 255, 255, 0.6)'
              : 'rgba(0, 0, 0, 0.6)',
            '--swap-approx-bg': isDarkMode 
              ? 'rgba(255, 255, 255, 0.05)'
              : 'rgba(44, 62, 80, 0.05)',
            '--swap-approx-border': isDarkMode 
              ? '1px solid rgba(255, 255, 255, 0.1)'
              : '1px solid rgba(44, 62, 80, 0.1)',
            '--swap-dropdown-bg': isDarkMode 
              ? '#1f2325ff'
              : 'rgba(255, 255, 255, 0.95)',
            '--swap-dropdown-border': isDarkMode 
              ? '1px solid rgba(255, 255, 255, 0.2)'
              : '1px solid rgba(44, 62, 80, 0.2)',
            '--swap-dropdown-shadow': isDarkMode 
              ? '0 4px 16px rgba(0, 0, 0, 0.3)'
              : '0 4px 16px rgba(0, 0, 0, 0.1)',
            '--swap-dropdown-text': isDarkMode 
              ? 'rgba(255, 255, 255, 0.9)'
              : 'rgba(0, 0, 0, 0.9)',
            '--swap-dropdown-item-border': isDarkMode 
              ? '1px solid rgba(255, 255, 255, 0.08)'
              : '1px solid rgba(44, 62, 80, 0.08)',
            '--swap-dropdown-disabled-text': isDarkMode 
              ? 'rgba(255, 255, 255, 0.4)'
              : 'rgba(0, 0, 0, 0.4)',
            '--swap-dropdown-ticker-bg': isDarkMode 
              ? 'rgba(255, 255, 255, 0.08)'
              : 'rgba(44, 62, 80, 0.08)',
            '--swap-dropdown-status-text': isDarkMode 
              ? 'rgba(255, 255, 255, 0.6)'
              : 'rgba(0, 0, 0, 0.6)',
            '--swap-scrollbar-track': isDarkMode 
              ? 'rgba(255, 255, 255, 0.1)'
              : 'rgba(44, 62, 80, 0.1)',
            '--swap-scrollbar-thumb': isDarkMode 
              ? 'rgba(255, 255, 255, 0.3)'
              : 'rgba(44, 62, 80, 0.3)',
            '--swap-scrollbar-thumb-hover': isDarkMode 
              ? 'rgba(255, 255, 255, 0.5)'
              : 'rgba(0, 0, 0, 0.5)',
            '--swap-switch-bg': isDarkMode 
              ? 'linear-gradient(45deg, #1f2325ff 0% , #1f2325ff 0%)'
              : 'linear-gradient(45deg, #e9ecef, #f8f9fa)',
            '--swap-switch-shadow': isDarkMode 
              ? '0 6px 16px rgba(52, 73, 94, 0.4)'
              : '0 6px 16px rgba(0, 0, 0, 0.1)',
            '--swap-switch-hover-bg': isDarkMode 
              ? 'linear-gradient(45deg, #2c3e50, #34495e)'
              : 'linear-gradient(45deg, #dee2e6, #e9ecef)',
            '--swap-switch-hover-shadow': isDarkMode 
              ? '0 8px 20px rgba(52, 73, 94, 0.5)'
              : '0 8px 20px rgba(0, 0, 0, 0.15)'
          }}
        >
          <div className={styles.swapLayout} onClick={(e) => e.stopPropagation()}>
            <div className={styles.swapPanel}>
              <div className={styles.swapHeader} style={{ padding: '8px 12px' }}>
                <Typography variant="h6" className={styles.swapTitle} style={{ fontSize: '15px' }}>Swap</Typography>
                <IconButton aria-label="Close swap" title="Close" onClick={handleCloseSwapModal} className={styles.closeButton} sx={{ 
                  color: isDarkMode ? 'rgba(255, 255, 255, 0.95)' : 'rgba(0, 0, 0, 0.95)', 
                  padding: '4px' 
                }}>
                  <Close sx={{ fontSize: '18px' }} />
                </IconButton>
              </div>
              <div className={styles.swapBody} style={{ padding: '8px 12px', gap: '6px' }}>
                {/* Swap Success Message */}
                {swapSuccess && (
                  <Alert 
                    severity="success" 
                    sx={{ 
                      mb: 1.5, 
                      borderRadius: '4px',
                      transition: 'all 0.3s ease-in-out',
                      opacity: 0,
                      animation: 'slideInDown 0.4s ease-in-out forwards',
                      '@keyframes slideInDown': {
                        '0%': { opacity: 0, transform: 'translateY(-20px)' },
                        '100%': { opacity: 1, transform: 'translateY(0)' }
                      }
                    }}
                  >
                    <Typography variant="body2" sx={{ fontFamily: 'sans-serif' }}>
                      Successfully swapped {lastSwapAmount} {isReversed ? `c${selectedToken} to ${selectedToken}` : `${selectedToken} to c${selectedToken}`}!
                    </Typography>
                  </Alert>
                )}

                {/* Swap User Cancellation Message */}
                {swapUserCancelled && (
                  <Alert 
                    severity="warning" 
                    sx={{ 
                      mb: 1.5, 
                      borderRadius: '4px',
                      transition: 'all 0.3s ease-in-out',
                      opacity: 0,
                      animation: 'slideInDown 0.4s ease-in-out forwards',
                      '@keyframes slideInDown': {
                        '0%': { opacity: 0, transform: 'translateY(-20px)' },
                        '100%': { opacity: 1, transform: 'translateY(0)' }
                      }
                    }}
                  >
                    <Typography variant="body2" sx={{ fontFamily: 'sans-serif' }}>
                      Swap cancelled by user. No funds were swapped.
                    </Typography>
                  </Alert>
                )}

                {/* Swap Transaction Error Message */}
                {swapTransactionError && (
                  <Alert 
                    severity="error" 
                    sx={{ 
                      mb: 1.5, 
                      borderRadius: '4px',
                      transition: 'all 0.3s ease-in-out',
                      opacity: 0,
                      animation: 'slideInDown 0.4s ease-in-out forwards',
                      '@keyframes slideInDown': {
                        '0%': { opacity: 0, transform: 'translateY(-20px)' },
                        '100%': { opacity: 1, transform: 'translateY(0)' }
                      }
                    }}
                  >
                    <Typography variant="body2" sx={{ fontFamily: 'sans-serif' }}>
                      Swap failed: {swapTransactionError}
                    </Typography>
                  </Alert>
                )}

                <Box>
                   <div className={styles.networkRow} style={{ marginBottom: '4px' }}>
                     <Typography variant="caption" sx={{ 
                       color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)', 
                       fontWeight: '500',
                       background: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(44, 62, 80, 0.05)',
                       padding: '4px 8px',
                       borderRadius: '0px',
                       border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(44, 62, 80, 0.1)'
                     }}>
                       {selectedNetwork}
                     </Typography>
                   </div>
                   
                  <div className={`${styles.tokenSection} ${styles.boxSpacing}`}>
                    <div className={styles.inputRow}>
                      <input
                        type="number"
                        className={styles.inputField}
                        value={swapAmount}
                        onChange={(e) => handleAmountChange(e.target.value)}
                        placeholder="0.0"
                        step="0.001"
                        min="0"
                      />
                      <div className={styles.inputSuffix}>
                        <button type="button" className={styles.maxButtonChip} onClick={handleMaxAmount}>MAX</button>
                        <button type="button" className={styles.tokenSelectorBtn} onClick={() => setTokenDropdownOpen(!tokenDropdownOpen)}>
                          <img
                            src={isReversed ? (selectedToken === 'WETH' ? '/assets/icons/cweth.svg' : 
                                              selectedToken === 'USDC' ? '/assets/icons/cusdc.svg' : 
                                              '/assets/icons/multi-collateral-dai-dai-logo.svg') : 
                                 (availableTokens.find(t => t.symbol === selectedToken)?.icon || '/assets/icons/eth-svgrepo-com.svg')}
                            alt={isReversed ? `Confidential ${selectedToken}` : (availableTokens.find(t => t.symbol === selectedToken)?.name || 'Ethereum')}
                          />
                          <span className={styles.suffixSymbol}>{isReversed ? `c${selectedToken}` : selectedToken}</span>
                          <span className={styles.caret}>▾</span>
                        </button>
                      </div>
                    </div>
                    {tokenDropdownOpen && (
                      <div className={styles.inlineDropdown}>
                        {availableTokens.map((token) => (
                          <button
                            key={token.symbol}
                            className={styles.dropdownItem}
                            onClick={() => {
                              if (token.functional) {
                                setSelectedToken(token.symbol);
                                setTokenDropdownOpen(false);
                              }
                            }}
                            disabled={!token.functional}
                          >
                            <span className={styles.dropdownLeft}>
                              <img 
                                src={token.icon} 
                                alt={token.name}
                              />
                              <span className={styles.dropdownName}>{isReversed ? `Confidential ${token.name}` : token.name}</span>
                              <span className={styles.dropdownTicker}>{isReversed ? `c${token.symbol}` : token.symbol}</span>
                            </span>
                            <span className={styles.dropdownStatus}>{token.functional ? 'Available' : 'Soon'}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Balance Display - Show for ERC20 tokens (forward swaps) */}
                  {!isReversed && (
                    <Box sx={{ 
                      mt: 1, 
                      mb: 1,
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      px: 1
                    }}>
                      <Typography variant="caption" sx={{ 
                        color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
                        fontSize: '12px'
                      }}>
                        Balance: {
                          selectedToken === 'WETH' 
                            ? (wethBalance ? (Number(wethBalance) / 1e18).toFixed(4) + ' WETH' : '0.0000 WETH')
                            : selectedToken === 'USDC' 
                              ? (usdcBalance ? (Number(usdcBalance) / 1e6).toFixed(4) + ' USDC' : '0.0000 USDC')
                              : selectedToken === 'DAI'
                                ? (daiBalance ? (Number(daiBalance) / 1e18).toFixed(4) + ' DAI' : '0.0000 DAI')
                                : '0.0000 ' + selectedToken
                        }
                      </Typography>
                      <Typography variant="caption" sx={{ 
                        color: isDarkMode ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)',
                        fontSize: '11px'
                      }}>
                        ≈ ${
                          selectedToken === 'WETH' 
                            ? (wethBalance ? (Number(wethBalance) / 1e18 * 4000).toFixed(2) : '0.00')
                            : selectedToken === 'USDC' 
                              ? (usdcBalance ? (Number(usdcBalance) / 1e6 * 1).toFixed(2) : '0.00')
                              : selectedToken === 'DAI'
                                ? (daiBalance ? (Number(daiBalance) / 1e18 * 1).toFixed(2) : '0.00')
                                : '0.00'
                        }
                      </Typography>
                    </Box>
                  )}
                  
                  {/* Confidential Token Balance Display - Show for reverse swaps */}
                  {isReversed && (
                    <Box sx={{ 
                      mt: 1, 
                      mb: 1,
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      px: 1
                    }}>
                      <Typography variant="caption" sx={{ 
                        color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
                        fontSize: '12px'
                      }}>
                        Balance: {
                          selectedToken === 'WETH' 
                            ? (cwethBalance.isDecrypted && cwethBalance.hasConfidentialToken 
                                ? cwethBalance.formattedBalance 
                                : cwethBalance.hasConfidentialToken 
                            ? '•••••••• cWETH'
                                  : '0.0000 cWETH')
                            : selectedToken === 'USDC' 
                              ? (cusdcBalance.isDecrypted && cusdcBalance.hasConfidentialToken 
                                  ? cusdcBalance.formattedBalance 
                                  : cusdcBalance.hasConfidentialToken 
                                    ? '•••••••• cUSDC'
                                    : '0.0000 cUSDC')
                              : selectedToken === 'DAI'
                                ? (cdaiBalance.isDecrypted && cdaiBalance.hasConfidentialToken 
                                    ? cdaiBalance.formattedBalance 
                                    : cdaiBalance.hasConfidentialToken 
                                      ? '•••••••• cDAI'
                                      : '0.0000 cDAI')
                                : '0.0000 c' + selectedToken
                        }
                      </Typography>
                      <Typography variant="caption" sx={{ 
                        color: isDarkMode ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)',
                        fontSize: '11px'
                      }}>
                        {selectedToken === 'WETH' 
                          ? (cwethBalance.isDecrypted && cwethBalance.hasConfidentialToken 
                              ? `≈ $${(parseFloat(cwethBalance.formattedBalance.replace(' cWETH', '')) * 4000).toFixed(2)}`
                              : cwethBalance.hasConfidentialToken 
                            ? '≈ $••••••••'
                                : '≈ $0.00')
                          : selectedToken === 'USDC' 
                            ? (cusdcBalance.isDecrypted && cusdcBalance.hasConfidentialToken 
                                ? `≈ $${(parseFloat(cusdcBalance.formattedBalance.replace(' cUSDC', '')) * 1).toFixed(2)}`
                                : cusdcBalance.hasConfidentialToken 
                                  ? '≈ $••••••••'
                                  : '≈ $0.00')
                            : selectedToken === 'DAI'
                              ? (cdaiBalance.isDecrypted && cdaiBalance.hasConfidentialToken 
                                  ? `≈ $${(parseFloat(cdaiBalance.formattedBalance.replace(' cDAI', '')) * 1).toFixed(2)}`
                                  : cdaiBalance.hasConfidentialToken 
                                    ? '≈ $••••••••'
                                    : '≈ $0.00')
                              : '≈ $0.00'
                        }
                      </Typography>
                    </Box>
                  )}
                  
                  {/* Balance Error Notification - Show for ERC20 tokens */}
                  {showBalanceError && !isReversed && (
                    <Box sx={{ 
                      mt: 1, 
                      mb: 1,
                      p: 1.5,
                      background: 'rgba(231, 76, 60, 0.1)',
                      border: '1px solid rgba(231, 76, 60, 0.3)',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1
                    }}>
                      <Typography sx={{ color: '#e74c3c', fontSize: '16px' }}>⚠️</Typography>
                      <Typography variant="caption" sx={{ 
                        color: '#e74c3c',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}>
                        Amount exceeds your balance of {
                          selectedToken === 'WETH' 
                            ? (wethBalance ? (Number(wethBalance) / 1e18).toFixed(4) + ' WETH' : '0.0000 WETH')
                            : selectedToken === 'USDC' 
                              ? (usdcBalance ? (Number(usdcBalance) / 1e6).toFixed(4) + ' USDC' : '0.0000 USDC')
                              : selectedToken === 'DAI'
                                ? (daiBalance ? (Number(daiBalance) / 1e18).toFixed(4) + ' DAI' : '0.0000 DAI')
                                : '0.0000 ' + selectedToken
                        }
                      </Typography>
                    </Box>
                  )}
                  
                  {/* Confidential Token Balance Error Notification - Show for reverse swaps */}
                  {showBalanceError && isReversed && (
                    <Box sx={{ 
                      mt: 1, 
                      mb: 1,
                      p: 1.5,
                      background: 'rgba(231, 76, 60, 0.1)',
                      border: '1px solid rgba(231, 76, 60, 0.3)',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1
                    }}>
                      <Typography sx={{ color: '#e74c3c', fontSize: '16px' }}>⚠️</Typography>
                      <Typography variant="caption" sx={{ 
                        color: '#e74c3c',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}>
                        {getReverseSwapErrorMessage()}
                      </Typography>
                    </Box>
                  )}
                  
                  <div className={`${styles.switchWrap} ${styles.switchGap}`} style={{ marginBottom: '4px' }}>
                    <div className={styles.switchButton} onClick={handleSwapReversal}>
                      <SwapHoriz sx={{ color: isDarkMode ? 'white' : '#000000', fontSize: 24 }} />
                    </div>
                  </div>
                  <div className={`${styles.tokenSection} ${styles.boxSpacing}`}>
                    <div className={styles.inputRow}>
                      <input
                        type="text"
                        className={`${styles.inputField} ${styles.readOnlyField}`}
                        value={showBalanceError ? '0.0' : (swapAmount || '0.0')}
                        readOnly
                      />
                      <div className={styles.inputSuffix}>
                        <div className={styles.tokenSelectorBtn}>
                          <img 
                            src={isReversed ? (availableTokens.find(t => t.symbol === selectedToken)?.icon || '/assets/icons/eth-svgrepo-com.svg') : 
                                 (selectedToken === 'WETH' ? '/assets/icons/cweth.svg' : 
                                  selectedToken === 'USDC' ? '/assets/icons/cusdc.svg' : 
                                  '/assets/icons/multi-collateral-dai-dai-logo.svg')} 
                            alt={isReversed ? (availableTokens.find(t => t.symbol === selectedToken)?.name || 'Ethereum') : `Confidential ${selectedToken}`}
                          />
                          <span className={styles.suffixSymbol}>{isReversed ? selectedToken : `c${selectedToken}`}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Box>
                <Box style={{ marginTop: '4px' }}>
                  <div className={styles.detailsCard} style={{ marginBottom: '4px' }}>
                    <Typography variant="caption" sx={{ 
                      display: 'block', 
                      color: isDarkMode ? 'rgba(255, 255, 255, 0.75)' : 'rgba(0, 0, 0, 0.75)' 
                    }}>
                      {isReversed ? `1 cWETH = 1 ${selectedToken}` : `1 ${selectedToken} = 1 cWETH`} • Fee ~$0.00
                    </Typography>
                  </div>
                  <div className={`${styles.actionsRow} ${styles.actionsSpacer}`}>
                    <Button 
                      
                      size="small" 
                      variant="contained" 
                      onClick={handleSwap}
                      disabled={(() => {
                        const hasValidAmount = swapAmount && parseFloat(swapAmount) > 0;
                        const isTokenFunctional = availableTokens.find(t => t.symbol === selectedToken)?.functional;
                        const isFHEReady = !isReversed || (fheInitialized && !fheError);
                        const hasNoBalanceError = !showBalanceError;
                        
                        return !hasValidAmount || 
                               (!isSwapCompleted && (isSwapPending || isSwapConfirming)) || 
                               !isTokenFunctional ||
                               !isFHEReady ||
                               !hasNoBalanceError;
                      })()}
                      className={styles.primaryAction}
                      sx={{
                        background: swapAmount && parseFloat(swapAmount) > 0 && availableTokens.find(t => t.symbol === selectedToken)?.functional && !showBalanceError && (!isReversed || (fheInitialized && !fheError))
                          ? 'linear-gradient(135deg, #efbe84 0%, #efbe84 0%)'
                          : undefined,
                        color: swapAmount && parseFloat(swapAmount) > 0 && availableTokens.find(t => t.symbol === selectedToken)?.functional && !showBalanceError && (!isReversed || (fheInitialized && !fheError))
                          ? 'white'
                          : undefined,
                        fontWeight: '700',
                        fontSize: '13px',
                        textTransform: 'none',
                        borderRadius: '0px',
                        py: 1,
                        boxShadow: swapAmount && parseFloat(swapAmount) > 0 && availableTokens.find(t => t.symbol === selectedToken)?.functional && !showBalanceError && (!isReversed || (fheInitialized && !fheError))
                          ? '0 4px 12px rgba(245, 245, 245, 1)'
                          : 'none',
                        '&:hover': swapAmount && parseFloat(swapAmount) > 0 && availableTokens.find(t => t.symbol === selectedToken)?.functional && !showBalanceError && (!isReversed || (fheInitialized && !fheError)) ? {
                          background: 'linear-gradient(135deg, #efbe84 0%, #efbe84 0%)',
                          boxShadow: '0 6px 16px rgba(255, 255, 255, 1)'
                        } : {},
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {(!isSwapCompleted && (isSwapPending || isSwapConfirming)) ? 'Processing...' : 
                       !availableTokens.find(t => t.symbol === selectedToken)?.functional ? 'Coming Soon' :
                       isReversed && !fheInitialized ? 'Initializing FHE...' :
                       isReversed && fheError ? 'FHE Error' :
                       !swapAmount || parseFloat(swapAmount) <= 0 ? 'Enter amount' : 
                       'Swap'}
                    </Button>
                  </div>
                  <div className={styles.advancedRow}>
                    <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>Advanced Options</Typography>
                    <div className={styles.advancedActions}>
                      <Button size="small" sx={{ color: 'rgba(255, 255, 255, 0.7)', textTransform: 'none' }}>Settings</Button>
                      <Button size="small" sx={{ color: 'rgba(255, 255, 255, 0.7)', textTransform: 'none' }}>History</Button>
                    </div>
                  </div>
                 </Box>
               </div>
             </div>
           </div>

        </Box>
      )}

      {/* Supply Modal */}
      {showSupplyModal && (
        <Box sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: isDarkMode ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <SupplyForm
            onTransactionSuccess={handleSupplySuccess}
            selectedAsset={selectedAsset}
            cwethBalance={cwethBalance}
            cusdcBalance={cusdcBalance}
            cdaiBalance={cdaiBalance}
            onClose={() => setShowSupplyModal(false)}
          />
        </Box>
      )}

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <Box sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: isDarkMode ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <WithdrawForm
            onTransactionSuccess={handleWithdrawSuccess}
            selectedAsset={selectedAsset}
            onClose={() => setShowWithdrawModal(false)}
            suppliedBalance={suppliedBalancesMap[selectedAsset?.symbol]?.formattedSupplied || '••••••••'}
            hasSupplied={suppliedBalancesMap[selectedAsset?.symbol]?.hasSupplied || false}
            isDecrypted={suppliedBalancesMap[selectedAsset?.symbol]?.isDecrypted || false}
          />
        </Box>
      )}

      {/* Borrow Modal */}
      {showBorrowModal && (
        <Box sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: isDarkMode ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <BorrowForm
            onTransactionSuccess={handleBorrowSuccess}
            onClose={() => setShowBorrowModal(false)}
            selectedAsset={selectedAsset}
          />
        </Box>
      )}

      {/* Repay Modal */}
      {showRepayModal && (
        <Box sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: isDarkMode ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <RepayForm
            onTransactionSuccess={handleRepaySuccess}
            onClose={() => setShowRepayModal(false)}
            selectedAsset={selectedAsset}
          />
        </Box>
      )}

      {/* Wallet Info Popup */}
      <Menu
        anchorEl={walletInfoAnchor}
        open={Boolean(walletInfoAnchor)}
        onClose={handleCloseWalletInfo}
        PaperProps={{
          sx: {
            mt: 1,
            minWidth: 280,
            maxWidth: 320,
            borderRadius: '0px',
            boxShadow: isDarkMode 
              ? '0 8px 32px rgba(0, 0, 0, 0.15)'
              : '0 8px 32px rgba(0, 0, 0, 0.1)',
            border: isDarkMode 
              ? '1px solid rgba(255, 255, 255, 0.1)'
              : '1px solid rgba(44, 62, 80, 0.1)',
            background: isDarkMode 
              ? 'linear-gradient(135deg, #2c3e50 0%, #1f2325ff 0%)'
              : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
            backdropFilter: 'blur(10px)',
            color: isDarkMode ? 'white' : '#000000'
          }
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <Box sx={{ p: 2 }}>
          {/* Header */}
          <Box sx={{ 
            mb: 2, 
            pb: 2, 
            borderBottom: isDarkMode 
              ? '1px solid rgba(255, 255, 255, 0.1)'
              : '1px solid rgba(44, 62, 80, 0.1)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <Typography variant="body1" sx={{ 
                        fontWeight: '600',
              color: isDarkMode ? 'white' : '#000000' 
            }}>
              Account
            </Typography>
            
            {/* Day/Night Mode Toggle */}
            <Box
              onClick={toggleTheme}
              sx={{
                width: 60,
                height: 28,
                borderRadius: '14px',
                background: isDarkMode 
                  ? 'linear-gradient(135deg, #2c3e50 0%, #1f2325ff 0%)'
                  : 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
                border: isDarkMode 
                  ? '1px solid rgba(255, 255, 255, 0.1)'
                  : '1px solid rgba(0, 0, 0, 0.1)',
                cursor: 'pointer',
                position: 'relative',
                transition: 'all 0.3s ease',
                boxShadow: isDarkMode 
                  ? '0 4px 12px rgba(0, 0, 0, 0.3)'
                  : '0 4px 12px rgba(0, 0, 0, 0.1)',
                '&:hover': {
                  transform: 'scale(1.05)',
                  boxShadow: isDarkMode 
                    ? '0 6px 16px rgba(0, 0, 0, 0.4)'
                    : '0 6px 16px rgba(0, 0, 0, 0.2)'
                }
              }}
            >
              {/* Moon Icon (Left) */}
              <Box sx={{
                position: 'absolute',
                left: '6px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '16px',
                height: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isDarkMode ? 'white' : 'rgba(0, 0, 0, 0.3)',
                transition: 'all 0.3s ease'
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              </Box>
              
              {/* Sun Icon (Right) */}
              <Box sx={{
                position: 'absolute',
                right: '6px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '16px',
                height: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isDarkMode ? 'rgba(255, 255, 255, 0.3)' : 'white',
                transition: 'all 0.3s ease'
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5"/>
                  <line x1="12" y1="1" x2="12" y2="3"/>
                  <line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="1" y1="12" x2="3" y2="12"/>
                  <line x1="21" y1="12" x2="23" y2="12"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
              </Box>
              
              {/* Slider */}
              <Box sx={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: isDarkMode 
                  ? 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)'
                  : 'linear-gradient(135deg, #ffd700 0%, #ffed4e 100%)',
                position: 'absolute',
                top: '3px',
                left: isDarkMode ? '3px' : '35px',
                transition: 'all 0.3s ease',
                boxShadow: isDarkMode 
                  ? '0 2px 8px rgba(0, 0, 0, 0.3)'
                  : '0 2px 8px rgba(255, 215, 0, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {/* Icon inside slider */}
                {isDarkMode ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2c3e50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ff8c00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5"/>
                    <line x1="12" y1="1" x2="12" y2="3"/>
                    <line x1="12" y1="21" x2="12" y2="23"/>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                    <line x1="1" y1="12" x2="3" y2="12"/>
                    <line x1="21" y1="12" x2="23" y2="12"/>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                  </svg>
                )}
              </Box>
            </Box>
          </Box>
          
          {/* Compact Address Section */}
          <Box sx={{ mb: 2 }}>
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1,
              p: 1.5,
              background: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(44, 62, 80, 0.05)',
              borderRadius: '0px',
              border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(44, 62, 80, 0.1)'
            }}>
              <Box sx={{ 
                width: 6, 
                height: 6, 
                borderRadius: '0px', 
                background: '#4caf50'
              }} />
              <Typography 
                variant="body2" 
                sx={{ 
                  fontFamily: 'monospace', 
                  flex: 1,
                  color: isDarkMode ? 'white' : '#000000',
                  fontSize: '0.8rem'
                }}
              >
                {address?.slice(0, 8)}...{address?.slice(-6)}
              </Typography>
              <IconButton
                size="small"
                onClick={handleCopyAddress}
                sx={{
                  color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
                  p: 0.5,
                  '&:hover': {
                    background: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(44, 62, 80, 0.1)',
                    color: isDarkMode ? 'white' : '#000000'
                  }
                }}
              >
                <ContentCopy sx={{ fontSize: 16 }} />
              </IconButton>
            </Box>
          </Box>

          {/* Network & Balance Row */}
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            mb: 2,
            p: 1.5,
            background: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(44, 62, 80, 0.05)',
            borderRadius: '0px',
            border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(44, 62, 80, 0.1)'
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ 
                width: 6, 
                height: 6, 
                borderRadius: '0px', 
                background: '#4caf50'
              }} />
              <Typography variant="body2" sx={{ 
                color: isDarkMode ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)', 
                fontSize: '0.8rem',
                fontWeight: isDarkMode ? '500' : '300'
              }}>
                {selectedNetwork}
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ 
              color: isDarkMode ? 'white' : '#000000', 
              fontWeight: isDarkMode ? '500' : '400',
              fontSize: '0.8rem' 
            }}>
              {balance && balance.formatted ? `${parseFloat(balance.formatted).toFixed(4)} ETH` : 
               isBalanceLoading ? 'Loading...' : 
               balanceError ? 'RPC Error' : '0.0000 ETH'}
            </Typography>
          </Box>

          {/* Disconnect Button */}
          <Button
            fullWidth
            variant="outlined"
            onClick={handleDisconnect}
            sx={{
              borderRadius: '0px',
              py: 1,
              textTransform: 'none',
              fontWeight: '500',
              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(44, 62, 80, 0.2)',
              color: isDarkMode ? 'rgba(255, 255, 255, 0.8)' : 'rgba(44, 62, 80, 0.8)',
              fontSize: '0.8rem',
              '&:hover': {
                background: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(44, 62, 80, 0.1)',
                borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.3)' : 'rgba(44, 62, 80, 0.3)',
                color: isDarkMode ? 'white' : '#000000'
              }
            }}
          >
            Disconnect
          </Button>
        </Box>
      </Menu>
    </>
  );
}
