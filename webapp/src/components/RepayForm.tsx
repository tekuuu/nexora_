'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useWalletClient } from 'wagmi';
import { createPublicClient, http, encodeFunctionData } from 'viem';
import { sepolia } from 'wagmi/chains';
import { POOL_ABI } from '../config/poolABI';
import { getFHEInstance } from '../utils/fhe';
import { CONTRACTS } from '../config/contracts';
import { ethers } from 'ethers';
import { getSepoliaRpcUrl } from '../utils/rpc';
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Divider,
  FormControlLabel,
  Checkbox,
  useTheme,
  Chip,
} from '@mui/material';
import { Close } from '@mui/icons-material';
import { useGasFee } from '../hooks/useGasFee';
import { parseTransactionError } from '../utils/errorHandling';

const CTOKEN_ABI = [
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
        "name": "from",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "to",
        "type": "address"
      },
      {
        "internalType": "externalEuint64",
        "name": "encryptedAmount",
        "type": "bytes32"
      },
      {
        "internalType": "bytes",
        "name": "inputProof",
        "type": "bytes"
      }
    ],
    "name": "confidentialTransferFrom",
    "outputs": [
      {
        "internalType": "euint64",
        "name": "transferred",
        "type": "bytes32"
      }
    ],
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
  }
] as const;

interface RepayFormProps {
  onTransactionSuccess?: () => Promise<void>;
  onClose?: () => void;
  selectedAsset?: {
    address: string;
    symbol: string;
    decimals: number;
    price?: number;
  };
  borrowedBalance?: string;
  hasBorrowed?: boolean;
  isDecrypted?: boolean;
  walletBalance?: string;
  hasWalletBalance?: boolean;
  isWalletBalanceDecrypted?: boolean;
}

export default function RepayForm({
  onTransactionSuccess,
  onClose,
  selectedAsset,
  borrowedBalance: propBorrowedBalance,
  hasBorrowed: propHasBorrowed,
  isDecrypted: propIsDecrypted,
  walletBalance: propWalletBalance,
  hasWalletBalance: propHasWalletBalance,
  isWalletBalanceDecrypted: propIsWalletBalanceDecrypted,
}: RepayFormProps = {}) {
  const { address, isConnected } = useAccount();
  const theme = useTheme();
  const { calculateNetworkFee, isLoading: isGasLoading, gasPrice } = useGasFee();

  const [amount, setAmount] = useState('');
  const [isValidAmount, setIsValidAmount] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [transactionError, setTransactionError] = useState<string | null>(null);
  const [userCancelled, setUserCancelled] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRepayingAll, setIsRepayingAll] = useState(false);
  const [submittedAmount, setSubmittedAmount] = useState('');
  const [submittedRepayAll, setSubmittedRepayAll] = useState(false);
  const [insufficientWalletFunds, setInsufficientWalletFunds] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [transactionPhase, setTransactionPhase] = useState<null | 'operator-approval' | 'repay'>(null);
  const [pendingRepayAmount, setPendingRepayAmount] = useState<string | null>(null);

  const handleClose = useCallback(() => {
    if (onClose) onClose();
  }, [onClose]);

  const { writeContract, data: hash, isPending, error: writeError, reset: resetWrite } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const { data: walletClient } = useWalletClient();


  const POOL_ADDRESS = (CONTRACTS.LENDING_POOL) as `0x${string}`;

  // Default to cUSDC if no asset provided
  const asset = selectedAsset || {
    address: CONTRACTS.CONFIDENTIAL_USDC,
    symbol: 'cUSDC',
    decimals: 6,
    price: 1,
  };

  // Use props for borrowed balance instead of hook
  const borrowedBalance = propBorrowedBalance || '••••••••';
  const hasBorrowed = propHasBorrowed || false;
  const isDecrypted = propIsDecrypted || false;

  // Use props for wallet balance
  const walletBalance = propWalletBalance || '••••••••';
  const hasWalletBalance = propHasWalletBalance || false;
  const isWalletBalanceDecrypted = propIsWalletBalanceDecrypted || false;

  // Function to check if pool is operator
  const checkOperatorStatus = useCallback(async () => {
    console.log('checkOperatorStatus called with:', { address, assetAddress: asset.address, poolAddress: CONTRACTS.LENDING_POOL });
    
    if (!address || !asset.address) {
      console.log('Missing required parameters for checkOperatorStatus');
      return;
    }

    try {
      console.log('Creating public client for operator check...');
      
      const publicClient = createPublicClient({
        chain: sepolia,
        transport: http(getSepoliaRpcUrl()),
      });

      console.log('Calling isOperator function...');
      
      // Safety check for publicClient
      if (!publicClient || typeof publicClient.call !== 'function') {
        console.error('❌ publicClient is not properly initialized in RepayForm');
        throw new Error('Public client not properly initialized');
      }
      
      const result = await publicClient.call({
        to: asset.address as `0x${string}`,
        data: encodeFunctionData({
          abi: CTOKEN_ABI,
          functionName: 'isOperator',
          args: [address as `0x${string}`, CONTRACTS.LENDING_POOL as `0x${string}`],
        }),
      });

      console.log('isOperator result:', result.data);
      
      if (result.data && result.data !== '0x') {
        const isOperator = result.data === '0x0000000000000000000000000000000000000000000000000000000000000001';
        console.log('Setting isApproved to:', isOperator);
        setIsApproved(isOperator);
        console.log('Is vault operator:', isOperator);
      } else {
        console.log('No data returned from isOperator call');
      }
    } catch (error) {
      console.error('Failed to check operator status:', error);
      setIsApproved(false);
    }
  }, [address, asset.address]);

  // Check operator status when amount changes
  useEffect(() => {
    if (amount && parseFloat(amount) > 0) {
      checkOperatorStatus();
    }
  }, [amount, checkOperatorStatus]);

  // Handle successful transaction
  useEffect(() => {
    console.log('Transaction success effect triggered:', { 
      isSuccess, 
      isReceiptError: false, // No isReceiptError in this component
      isApproved, 
      hash,
      error: writeError?.message,
      transactionPhase
    });
    
    if (isSuccess && transactionPhase === 'operator-approval') {
      // Operator permission was successful, now check operator status
      console.log('Operator permission successful, checking status...');
      setTimeout(() => {
        console.log('Calling checkOperatorStatus...');
        checkOperatorStatus();
      }, 2000); // Wait 2 seconds for the transaction to be mined
      // After approval receipt, if we had a pending amount, auto-repay it
      if (pendingRepayAmount) {
        setTimeout(() => {
          console.log('Auto-repaying after operator approval with amount:', pendingRepayAmount);
          performRepay(pendingRepayAmount).catch((e) => console.error('Auto-repay failed:', e));
          setPendingRepayAmount(null);
        }, 2500);
      }
      setTransactionPhase(null);
    } else if (isSuccess && transactionPhase === 'repay') {
      // This is the repay transaction success
      console.log('✅ Repay transaction successful!');
      setShowSuccess(true);
      setTransactionPhase(null);
      setAmount('');
      // DON'T reset isApproved here - operator permission persists!
      setTransactionError(null);
      setUserCancelled(false);
      
      // Reset the write contract state to clear pending states
      setTimeout(() => {
        resetWrite();
      }, 100);
      
      setTimeout(() => setShowSuccess(false), 5000);
      
      // Refresh all dashboard balances
      if (onTransactionSuccess) {
        console.log('🔄 Refreshing dashboard balances after repay...');
        onTransactionSuccess().catch((error) => {
          console.error('Error refreshing balances:', error);
        });
      }
    }
  }, [isSuccess, checkOperatorStatus, hash, writeError, onTransactionSuccess, resetWrite, transactionPhase, pendingRepayAmount]);

  // Handle write errors
  useEffect(() => {
    if (writeError) {
      console.log('Transaction error:', writeError);
      
      // Check if user rejected the transaction
      if (writeError.message.toLowerCase().includes('user rejected') ||
          writeError.message.toLowerCase().includes('user denied') ||
          writeError.message.toLowerCase().includes('rejected the request')) {
        setUserCancelled(true);
        setTransactionError(null);
        setTransactionPhase(null);
        setAmount(''); // Clear input on cancellation
      } else {
        // Other errors (network, contract, etc.)
        setTransactionError(parseTransactionError(writeError));
        setUserCancelled(false);
        setTransactionPhase(null);
        setAmount(''); // Clear input on error
      }
      
      // Reset the write contract state to clear pending states
      setTimeout(() => {
        resetWrite();
      }, 100);
    }
  }, [writeError, resetWrite]);

  const performRepay = async (repayAmount: string) => {
    if (!repayAmount || !address || !walletClient) return;
    setTransactionPhase('repay');
    try {
      // Convert to token units based on decimals
      const amountFloat = parseFloat(repayAmount);
      if (Number.isNaN(amountFloat) || amountFloat <= 0) {
        throw new Error('Invalid amount');
      }

      const decimals = asset.decimals ?? 18;
      const amountInWei = BigInt(Math.floor(amountFloat * Math.pow(10, decimals)));

      // Prepare FHE encrypted input bound to Pool
      const fheInstance = await getFHEInstance();

      const input = (fheInstance as any).createEncryptedInput(
        POOL_ADDRESS as `0x${string}`,
        address as `0x${string}`
      );

      // Always use add64 to match Pool expectation (euint64)
      input.add64(amountInWei);

      // Encrypt
      const encryptedAmount = await input.encrypt();

      // Normalize encrypted payload
      const formattedEncryptedAmount = toHex(encryptedAmount.handles?.[0]);
      const formattedInputProof = toHex(encryptedAmount.inputProof);

      // Preflight simulation: attempt a callStatic to detect reverts before sending tx
      try {
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const iface = new ethers.Interface(POOL_ABI as any);
        const data = iface.encodeFunctionData('repay', [asset.address, formattedEncryptedAmount, formattedInputProof, isRepayingAll]);
        // Perform an eth_call simulation which will revert if the contract would revert
        await provider.call({ to: POOL_ADDRESS as string, data, from: address });
      } catch (simErr: any) {
        console.error('Preflight repay simulation failed:', simErr);
        setTransactionError(parseTransactionError(simErr) || 'Preflight simulation failed; transaction would revert.');
        setIsProcessing(false);
        return;
      }

      // Submit repay txn
      writeContract({
        address: CONTRACTS.LENDING_POOL as `0x${string}`,
        abi: POOL_ABI,
        functionName: 'repay',
        args: [
          asset.address as `0x${string}`,
          formattedEncryptedAmount,
          formattedInputProof,
          isRepayingAll,
        ],
        gas: BigInt(800000),
        gasPrice: gasPrice ?? undefined,
      });
    } catch (err: any) {
      console.error('Repay error:', err);
      setTransactionError(parseTransactionError(err));
      setIsProcessing(false);
    }
  };

  const handleRepay = async () => {
    if (!isValidAmount || !amount || !address || !walletClient) return;

    // Clear previous error states when starting new transaction
    setTransactionError(null);
    setUserCancelled(false);
    setBalanceError(null);

    try {
      if (!isApproved) {
        // Step 1: Set vault as operator (time-limited permission)
        console.log('Step 1: Setting vault as operator...');
        setTransactionPhase('operator-approval');
        const until = Math.floor(Date.now() / 1000) + 3600; // Current timestamp + 1 hour
        console.log('setOperator parameters:', {
          address: asset.address,
          poolAddress: CONTRACTS.LENDING_POOL,
          until: until,
          untilType: typeof until
        });
        try {
          writeContract({
            address: asset.address as `0x${string}`,
            abi: CTOKEN_ABI,
            functionName: 'setOperator',
            args: [CONTRACTS.LENDING_POOL as `0x${string}`, until],
          });
          console.log('Operator permission initiated...');
        } catch (writeError) {
          console.error('writeContract error:', writeError);
          throw writeError;
        }
        // Remember desired repay amount to auto-repay after approval
        setPendingRepayAmount(amount);
      } else {
        await performRepay(amount);
      }
    } catch (err) {
      console.error('Transaction failed:', err);
    }
  };

  // Calculate total cost including real network fee
  const calculateTotalCost = (): string => {
    const decimalsToShow = asset.decimals === 6 ? 2 : 6;
    if (!amount) return `0.${'0'.repeat(decimalsToShow)} ${asset.symbol}`;

    const amountValue = parseFloat(amount);
    const protocolFee = 0.000000; // No protocol fee

    const total = amountValue + protocolFee;
    return `${total.toFixed(decimalsToShow)} ${asset.symbol}`;
  };

  const handleMaxAmount = () => {
    // If balance contains asset symbol, use the actual amount (regardless of isDecrypted flag)
    if (borrowedBalance.includes(asset.symbol)) {
      const balanceValue = parseFloat(borrowedBalance.replace(` ${asset.symbol}`, ''));
      setAmount(balanceValue.toString());
      console.log('🔍 MAX button: Set amount to borrowed balance:', balanceValue);
    } else if (hasBorrowed) {
      // If we have borrowed balance but it's encrypted (••••••••), we can't set exact amount
      console.log('🔍 MAX button: Balance is encrypted, cannot set exact amount');
    } else {
      // No borrowed balance available
      console.log('🔍 MAX button: No borrowed balance available');
    }
  };

  const handleRepayAllChange = (checked: boolean) => {
    setIsRepayingAll(checked);
    if (checked) {
      if (isDecrypted && isWalletBalanceDecrypted && borrowedBalance.includes(asset.symbol) && walletBalance.includes(asset.symbol)) {
        const borrowedValue = parseFloat(borrowedBalance.replace(` ${asset.symbol}`, ''));
        const walletValue = parseFloat(walletBalance.replace(` ${asset.symbol}`, ''));
        if (walletValue >= borrowedValue) {
          setAmount(borrowedValue.toString());
          setInsufficientWalletFunds(false);
        } else {
          setInsufficientWalletFunds(true);
          // Don't set amount if insufficient funds
        }
      } else if (isDecrypted && borrowedBalance.includes(asset.symbol)) {
        // If wallet balance not decrypted, still allow checkbox but don't auto-fill
        setInsufficientWalletFunds(false);
      }
    }
    if (!checked) {
      setBalanceError(null);
      setInsufficientWalletFunds(false);
    }
  };

  const toHex = (v: any): `0x${string}` => {
    if (v instanceof Uint8Array) {
      return ('0x' + Array.from(v).map((b: number) => b.toString(16).padStart(2, '0')).join('')) as `0x${string}`;
    }
    if (typeof v === 'string') {
      return v.startsWith('0x') ? (v as `0x${string}`) : ('0x' + v) as `0x${string}`;
    }
    throw new Error('Unsupported encrypted payload type');
  };

  useEffect(() => {
    console.log('🔍 RepayForm validation:', { amount, hasBorrowed, borrowedBalance, walletBalance, isRepayingAll });

    // Clear previous error
    setBalanceError(null);
    setInsufficientWalletFunds(false);

    // Check if we have a valid amount and the user has borrowed
    if (amount && hasBorrowed) {
      const amountWei = parseFloat(amount);

      // If balance is decrypted (contains asset symbol), validate against actual balance
      if (borrowedBalance.includes(asset.symbol)) {
        const borrowedWei = parseFloat(borrowedBalance.replace(` ${asset.symbol}`, ''));

        // Calculate total cost (no protocol fee, no network fee for repay)
        const protocolFee = 0.000000; // No protocol fee
        const totalCost = amountWei + protocolFee; // Only amount + protocol fee

        let isValid = amountWei > 0 && totalCost <= borrowedWei;
        if (isRepayingAll) {
          isValid = isValid && amountWei >= borrowedWei;
        }

        // Additional validation: check wallet balance if available
        if (walletBalance && walletBalance.includes(asset.symbol) && isWalletBalanceDecrypted) {
          const walletWei = parseFloat(walletBalance.replace(` ${asset.symbol}`, ''));
          console.log('🔍 Wallet balance validation:', { totalCost, walletWei, asset: asset.symbol });
          if (totalCost > walletWei) {
            isValid = false;
            const decimalsToShow = asset.decimals === 6 ? 2 : 4;
            setBalanceError(`Insufficient wallet balance! You have ${walletWei.toFixed(decimalsToShow)} ${asset.symbol} in your wallet, but need ${totalCost.toFixed(decimalsToShow)} ${asset.symbol} to repay.`);
            console.log('❌ Wallet balance insufficient - transaction blocked');
          } else {
            console.log('✅ Wallet balance sufficient');
          }
        } else if (walletBalance && !walletBalance.includes(asset.symbol)) {
          console.log('⚠️ Wallet balance format issue:', { walletBalance, assetSymbol: asset.symbol });
        } else if (!walletBalance) {
          console.log('⚠️ No wallet balance provided');
        } else if (!isWalletBalanceDecrypted) {
          console.log('⚠️ Wallet balance not decrypted');
        }

        setIsValidAmount(isValid);

        if (totalCost > borrowedWei) {
          const decimalsToShow = asset.decimals === 6 ? 2 : 4;
          setBalanceError(`Insufficient balance! You have ${borrowedWei.toFixed(decimalsToShow)} ${asset.symbol} available, but need ${totalCost.toFixed(decimalsToShow)} ${asset.symbol}.`);
        } else if (isRepayingAll && amountWei < borrowedWei) {
          const decimalsToShow = asset.decimals === 6 ? 2 : 4;
          setBalanceError(`To repay all debt, the amount must be at least ${borrowedWei.toFixed(decimalsToShow)} ${asset.symbol}.`);
        }

        console.log('🔍 Decrypted balance validation:', {
          amountWei,
          borrowedWei,
          walletWei: walletBalance && walletBalance.includes(asset.symbol) ? parseFloat(walletBalance.replace(` ${asset.symbol}`, '')) : 'encrypted',
          protocolFee,
          totalCost,
          isValid,
          isRepayingAll
        });
      } else {
        const isValid = amountWei > 0;
        setIsValidAmount(isValid);
        console.log('🔍 Encrypted balance validation:', { amountWei, isValid });
      }
    } else {
      setIsValidAmount(false);
      if (amount && !hasBorrowed) {
        setBalanceError('No borrowed balance available');
      }
      console.log('🔍 Validation failed:', { hasAmount: !!amount, hasBorrowed });
    }
  }, [amount, borrowedBalance, hasBorrowed, walletBalance, isWalletBalanceDecrypted, asset.decimals, asset.symbol, isRepayingAll]);

  const disabled =
    !isValidAmount ||
    isPending ||
    isConfirming ||
    isProcessing ||
    !isConnected ||
    !!balanceError; // Block transaction if there's any balance error

  if (!isConnected) {
    return (
      <Alert severity="info">
        Please connect your wallet to repay {asset.symbol} from the confidential lending pool.
      </Alert>
    );
  }

  return (
    <Box sx={{
      maxWidth: 350,
      mx: 'auto',
      p: 1,
      position: 'relative',
      backgroundColor: 'background.paper',
      borderRadius: 1,
      boxShadow: 3,
      border: '1px solid',
      borderColor: 'divider'
    }}>
      {/* Close Button */}
      <Button
        onClick={handleClose}
        sx={{
          position: 'absolute',
          top: 8,
          right: 8,
          minWidth: 'auto',
          p: 0.5,
          borderRadius: '50%',
          color: 'text.secondary',
          '&:hover': {
            background: 'action.hover'
          }
        }}
      >
        ✕
      </Button>

      {/* Header */}
      <Box sx={{ mb: 1.5, textAlign: 'center' }}>
        <Typography variant="h6" gutterBottom sx={{ mb: 1, fontWeight: 600, fontFamily: 'sans-serif' }}>
          Repay {asset.symbol}
        </Typography>
      </Box>

      {showSuccess && (
        <Alert
          severity="success"
          sx={{
            mb: 1.5,
            borderRadius: '4px',
            transition: 'all 0.3s ease-in-out',
            transform: 'translateY(-100%)',
            animation: 'slideInDown 0.4s ease-in-out forwards',
            '@keyframes slideInDown': {
              '0%': { transform: 'translateY(-100%)' },
              '100%': { transform: 'translateY(0)' }
            }
          }}
        >
          <Typography variant="body2" sx={{ fontFamily: 'sans-serif' }}>
            {submittedRepayAll ? 'Successfully repaid all debt and cleared your position!' : `Successfully repaid ${submittedAmount} ${asset.symbol}!`}
          </Typography>
        </Alert>
      )}

      {userCancelled && (
        <Alert
          severity="warning"
          sx={{
            mb: 1.5,
            borderRadius: '4px',
            transition: 'all 0.3s ease-in-out',
            transform: 'translateY(-100%)',
            animation: 'slideInDown 0.4s ease-in-out forwards',
            '@keyframes slideInDown': {
              '0%': { transform: 'translateY(-100%)' },
              '100%': { transform: 'translateY(0)' }
            }
          }}
        >
          <Typography variant="body2" sx={{ fontFamily: 'sans-serif' }}>
            Transaction cancelled by user. No funds were repaid.
          </Typography>
        </Alert>
      )}

      {transactionError && (
        <Alert
          severity="error"
          sx={{
            mb: 1.5,
            borderRadius: '4px',
            transition: 'all 0.3s ease-in-out',
            transform: 'translateY(-100%)',
            animation: 'slideInDown 0.4s ease-in-out forwards',
            '@keyframes slideInDown': {
              '0%': { transform: 'translateY(-100%)' },
              '100%': { transform: 'translateY(0)' }
            }
          }}
        >
          <Typography variant="body2" sx={{ fontFamily: 'sans-serif' }}>
            Transaction failed: {transactionError}
          </Typography>
        </Alert>
      )}

      {balanceError && (
        <Alert
          severity="warning"
          sx={{
            mb: 1.5,
            borderRadius: '4px',
            transition: 'all 0.3s ease-in-out',
            transform: 'translateY(-100%)',
            animation: 'slideInDown 0.4s ease-in-out forwards',
            '@keyframes slideInDown': {
              '0%': { transform: 'translateY(-100%)' },
              '100%': { transform: 'translateY(0)' }
            }
          }}
        >
          <Typography variant="body2" sx={{ fontFamily: 'sans-serif' }}>
            {balanceError}
          </Typography>
        </Alert>
      )}

      {insufficientWalletFunds && (
        <Alert
          severity="error"
          sx={{
            mb: 1.5,
            borderRadius: '4px',
            transition: 'all 0.3s ease-in-out',
            transform: 'translateY(-100%)',
            animation: 'slideInDown 0.4s ease-in-out forwards',
            '@keyframes slideInDown': {
              '0%': { transform: 'translateY(-100%)' },
              '100%': { transform: 'translateY(0)' }
            }
          }}
        >
          <Typography variant="body2" sx={{ fontFamily: 'sans-serif' }}>
            Insufficient wallet balance! You need at least {borrowedBalance} in your wallet to repay all debt, but you only have {walletBalance}.
          </Typography>
        </Alert>
      )}

      {/* Amount Input */}
      <Box sx={{ mb: 1 }}>
        <TextField
          fullWidth
          label="Repay Amount"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={isPending || isConfirming}
          placeholder="0.00"
          InputProps={{
            startAdornment: (
              <Typography variant="body1" sx={{ mr: 1, color: 'text.secondary', fontFamily: 'sans-serif' }}>
                {asset.symbol}
              </Typography>
            ),
            endAdornment: (
              <Button
                size="small"
                variant="outlined"
                onClick={handleMaxAmount}
                disabled={isPending || isConfirming || !hasBorrowed}
                sx={{
                  ml: 1,
                  minWidth: 'auto',
                  px: 1.5,
                  fontSize: '0.75rem',
                  textTransform: 'none',
                  borderRadius: 1
                }}
              >
                MAX
              </Button>
            ),
          }}
          helperText={
            hasBorrowed
              ? borrowedBalance
              : 'No borrowed balance'
          }
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: '4px',
              fontSize: '1rem'
            },
            // Hide the number input spinners
            '& input[type=number]': {
              MozAppearance: 'textfield',
            },
            '& input[type=number]::-webkit-outer-spin-button': {
              WebkitAppearance: 'none',
              margin: 0,
            },
            '& input[type=number]::-webkit-inner-spin-button': {
              WebkitAppearance: 'none',
              margin: 0,
            }
          }}
        />
      </Box>

      {/* Repay All Checkbox */}
      <Box sx={{ mb: 1.5 }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={isRepayingAll}
              onChange={(e) => handleRepayAllChange(e.target.checked)}
              disabled={isPending || isConfirming || !hasBorrowed || !isDecrypted || !hasWalletBalance || !isWalletBalanceDecrypted}
              sx={{
                color: 'primary.main',
                '&.Mui-checked': {
                  color: 'primary.main',
                },
                '&.Mui-disabled': {
                  color: 'action.disabled',
                },
              }}
            />
          }
          label="Repay All Debt"
          sx={{
            alignItems: 'flex-start',
            '& .MuiFormControlLabel-label': {
              fontSize: '0.9rem',
              fontFamily: 'sans-serif',
              color: 'text.primary',
            },
          }}
        />
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, fontFamily: 'sans-serif' }}>
          This will clear your entire debt position for this asset. The amount entered must cover your full borrowed balance and you must have sufficient wallet balance (confidential tokens) to cover the repayment.
        </Typography>
        <Typography variant="caption" color="error" sx={{ display: isDecrypted ? 'none' : 'block', mt: 0.5, fontFamily: 'sans-serif' }}>
          Repay All requires your borrowed balance to be decrypted so the exact amount can be verified. Please decrypt your balance or uncheck &quot;Repay All Debt&quot;.
        </Typography>
        <Typography variant="caption" color="warning.main" sx={{ display: (!hasWalletBalance || !isWalletBalanceDecrypted) ? 'block' : 'none', mt: 0.5, fontFamily: 'sans-serif' }}>
          Repay All requires your wallet balance to be decrypted to verify you have sufficient funds. Please decrypt your wallet balance.
        </Typography>
      </Box>

      {/* Transaction Summary */}
      <Box sx={{
        mb: 1.5,
        p: 1,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: '4px',
        backgroundColor: 'background.paper',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          borderColor: 'primary.main',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }
      }}>
        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, mb: 0.5, fontFamily: 'sans-serif' }}>
          Summary
        </Typography>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
          <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'sans-serif' }}>Amount</Typography>
          <Typography variant="body2" sx={{ fontWeight: 500, fontFamily: 'sans-serif' }}>
            {amount ? `${parseFloat(amount).toFixed(asset.decimals === 6 ? 2 : 4)} ${asset.symbol}` : `0.${'0'.repeat(asset.decimals === 6 ? 2 : 4)} ${asset.symbol}`}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
          <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'sans-serif' }}>Protocol Fee</Typography>
          <Typography variant="body2" sx={{ fontWeight: 500, fontFamily: 'sans-serif' }}>
            0.${'0'.repeat(asset.decimals === 6 ? 2 : 6)} {asset.symbol}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
          <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'sans-serif' }}>Network Fee</Typography>
          <Typography variant="body2" sx={{ fontWeight: 500, fontFamily: 'sans-serif' }}>
            {isGasLoading ? 'Loading...' : calculateNetworkFee('REPAY')}
          </Typography>
        </Box>

        <Divider sx={{ my: 0.5 }} />

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'sans-serif' }}>Total</Typography>
          <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'sans-serif' }}>
            {isGasLoading ? 'Loading...' : calculateTotalCost()}
          </Typography>
        </Box>
      </Box>

      {/* Debug Indicators (non-intrusive) */}
      <Box sx={{ mt: 0.5, mb: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
        <Chip
          size="small"
          variant="outlined"
          label={`FHE: Pool ${CONTRACTS.LENDING_POOL.slice(0, 6)}...${CONTRACTS.LENDING_POOL.slice(-4)}`}
        />
        <Chip
          size="small"
          variant="outlined"
          color={isApproved ? 'success' : 'default'}
          label={`Operator: ${isApproved ? 'yes' : 'no'}`}
        />
        <Chip
          size="small"
          variant="outlined"
          label={`Balance: ${isDecrypted ? 'decrypted' : 'encrypted'}`}
        />
      </Box>

      {/* Submit Button */}
      <Button
        fullWidth
        variant="contained"
        size="medium"
        onClick={handleRepay}
        disabled={disabled}
        startIcon={isPending || isConfirming || isProcessing ? <CircularProgress size={20} /> : undefined}
        sx={{
          py: 1.2,
          borderRadius: '4px',
          fontSize: '0.95rem',
          fontWeight: 600,
          textTransform: 'none',
          boxShadow: 2,
          transition: 'all 0.15s ease-in-out',
          '&:hover': {
            boxShadow: 4,
            transform: 'translateY(-1px)',
            scale: 1.02
          },
          '&:active': {
            transform: 'translateY(1px) scale(0.98)',
            boxShadow: 1,
            transition: 'all 0.1s ease-in-out'
          },
          '&:focus': {
            outline: 'none',
            boxShadow: '0 0 0 3px rgba(25, 118, 210, 0.3)'
          },
          '&:disabled': {
            opacity: 0.6,
            transform: 'none',
            scale: 1,
            boxShadow: 2
          }
        }}
      >
        {transactionPhase === 'operator-approval' && isPending
          ? 'Setting Operator...'
          : transactionPhase === 'operator-approval' && isConfirming
          ? 'Confirming Approval...'
          : transactionPhase === 'repay' && (isPending || isProcessing)
          ? 'Repaying...'
          : transactionPhase === 'repay' && isConfirming
          ? 'Confirming Repay...'
          : isApproved
          ? `Repay ${asset.symbol}`
          : 'Set Operator'}
      </Button>

      {/* Transaction Hash */}
      {hash && (
        <Box sx={{
          mt: 1,
          p: 0.5,
          backgroundColor: 'action.hover',
          borderRadius: 1,
          textAlign: 'center',
          transition: 'all 0.2s ease-in-out',
          opacity: 0,
          animation: 'fadeIn 0.3s ease-in-out forwards',
          '@keyframes fadeIn': {
            '0%': { opacity: 0, transform: 'translateY(10px)' },
            '100%': { opacity: 1, transform: 'translateY(0)' }
          }
        }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'sans-serif' }}>
            {hash?.slice(0, 10)}...{hash?.slice(-8)}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
