'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { POOL_ABI } from '../config/poolABI';
import { getFHEInstance } from '../utils/fhe';
import { CONTRACTS } from '../config/contracts';
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
  useTheme,
} from '@mui/material';
import { Close } from '@mui/icons-material';
import { useGasFee } from '../hooks/useGasFee';
import { parseTransactionError } from '../utils/errorHandling';

interface RepayFormProps {
  onTransactionSuccess?: () => void;
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
}

export default function RepayForm({
  onTransactionSuccess,
  onClose,
  selectedAsset,
  borrowedBalance: propBorrowedBalance,
  hasBorrowed: propHasBorrowed,
  isDecrypted: propIsDecrypted,
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

  const handleClose = useCallback(() => {
    if (onClose) onClose();
  }, [onClose]);

  const { writeContract, data: hash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });


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

  // Handle successful transaction
  useEffect(() => {
    if (isSuccess && hash) {
      console.log('✅ Repay transaction successful!');
      setShowSuccess(true);
      setAmount('');
      setIsValidAmount(false);
      setTransactionError(null);
      setUserCancelled(false);

      // Call onTransactionSuccess to refresh balances in Dashboard
      if (onTransactionSuccess) {
        onTransactionSuccess();
      }

      // Hide success message and close form after 5 seconds
      setTimeout(() => {
        setShowSuccess(false);
        if (onClose) onClose();
      }, 5000);
    }
  }, [isSuccess, hash, onTransactionSuccess]);

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
        setAmount(''); // Clear input on cancellation
      } else {
        // Other errors (network, contract, etc.)
        setTransactionError(parseTransactionError(writeError));
        setUserCancelled(false);
        setAmount(''); // Clear input on error
      }

      setIsProcessing(false);
    }
  }, [writeError]);

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

  const toHex = (v: any): `0x${string}` => {
    if (v instanceof Uint8Array) {
      return ('0x' + Array.from(v).map((b: number) => b.toString(16).padStart(2, '0')).join('')) as `0x${string}`;
    }
    if (typeof v === 'string') {
      return v.startsWith('0x') ? (v as `0x${string}`) : ('0x' + v) as `0x${string}`;
    }
    throw new Error('Unsupported encrypted payload type');
  };

  const handleRepay = async () => {
    if (!isValidAmount || !amount || !address) return;

    // Clear previous error states when starting new transaction
    setTransactionError(null);
    setUserCancelled(false);
    setBalanceError(null);

    setIsProcessing(true);

    try {
      // Convert to token units based on decimals
      const amountFloat = parseFloat(amount);
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

      // Submit repay txn
      writeContract({
        address: CONTRACTS.LENDING_POOL as `0x${string}`,
        abi: POOL_ABI,
        functionName: 'repay',
        args: [
          asset.address as `0x${string}`,
          formattedEncryptedAmount,
          formattedInputProof,
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

  useEffect(() => {
    console.log('🔍 RepayForm validation:', { amount, hasBorrowed, borrowedBalance });

    // Clear previous error
    setBalanceError(null);

    // Check if we have a valid amount and the user has borrowed
    if (amount && hasBorrowed) {
      const amountWei = parseFloat(amount);

      // If balance is decrypted (contains asset symbol), validate against actual balance
      if (borrowedBalance.includes(asset.symbol)) {
        const borrowedWei = parseFloat(borrowedBalance.replace(` ${asset.symbol}`, ''));

        // Calculate total cost (no protocol fee, no network fee for repay)
        const protocolFee = 0.000000; // No protocol fee
        const totalCost = amountWei + protocolFee; // Only amount + protocol fee

        const isValid = amountWei > 0 && totalCost <= borrowedWei;
        setIsValidAmount(isValid);

        if (totalCost > borrowedWei) {
          const decimalsToShow = asset.decimals === 6 ? 2 : 4;
          setBalanceError(`Insufficient balance! You have ${borrowedWei.toFixed(decimalsToShow)} ${asset.symbol} available, but need ${totalCost.toFixed(decimalsToShow)} ${asset.symbol}.`);
        }

        console.log('🔍 Decrypted balance validation:', {
          amountWei,
          borrowedWei,
          protocolFee,
          totalCost,
          isValid
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
  }, [amount, borrowedBalance, hasBorrowed, asset.decimals, asset.symbol]);

  const disabled =
    !isValidAmount ||
    isPending ||
    isConfirming ||
    isProcessing ||
    !isConnected;

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
            Successfully repaid {amount} {asset.symbol}!
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
        {isPending ? 'Repaying...' : isConfirming ? 'Confirming...' : 'Repay'}
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
