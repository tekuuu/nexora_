'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import { CONTRACTS } from '../config/contracts';
import { POOL_ABI } from '../config/poolABI';
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
} from '@mui/material';
import { TrendingDown, Close } from '@mui/icons-material';
import { getFHEInstance } from '../utils/fhe';

interface BorrowFormProps {
  onTransactionSuccess?: () => void;
  onClose?: () => void;
  selectedAsset?: {
    address: string;
    symbol: string;
    decimals: number;
    ltv: number;
    price: number;
  };
}

export default function BorrowForm({
  onTransactionSuccess,
  onClose,
  selectedAsset,
}: BorrowFormProps) {
  const { address, isConnected } = useAccount();
  const [amount, setAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [transactionError, setTransactionError] = useState<string | null>(null);
  const [lastSubmittedAmount, setLastSubmittedAmount] = useState<string>('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [userCancelled, setUserCancelled] = useState(false);
  const [isValidAmount, setIsValidAmount] = useState(false);

  const { writeContract, writeContractAsync, data: hash, isPending, error: writeError, reset: resetWrite } = useWriteContract();
  const { isLoading: isConfirming, isSuccess, isError: isReceiptError } = useWaitForTransactionReceipt({ hash });

  const POOL_ADDRESS = (CONTRACTS.LENDING_POOL) as `0x${string}`;

  // Use the selected asset or default to cUSDC
  const asset = selectedAsset || {
    address: CONTRACTS.CONFIDENTIAL_USDC,
    symbol: 'cUSDC',
    decimals: 6,
    ltv: 80,
    price: 1,
  };

  // Handle successful transaction
  useEffect(() => {
    if (isSuccess && hash) {
      console.log('✅ Borrow transaction successful!');
      setShowSuccess(true);
      setAmount('');
      setIsValidAmount(false);
      setTransactionError(null);
      setUserCancelled(false);

      // Reset the write contract state to clear pending states
      setTimeout(() => {
        resetWrite();
      }, 100);

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
  }, [isSuccess, hash, onTransactionSuccess, onClose, resetWrite]);

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
        setTransactionError(writeError.message);
        setUserCancelled(false);
        setAmount(''); // Clear input on error
      }

      setIsProcessing(false);

      // Reset the write contract state to clear pending states
      setTimeout(() => {
        resetWrite();
      }, 100);
    }
  }, [writeError, resetWrite]);

  // Handle on-chain receipt failures
  useEffect(() => {
    if (isReceiptError) {
      setTransactionError('Transaction failed: reverted on-chain');
      setIsProcessing(false);

      // Clear wagmi write state to unblock the UI
      setTimeout(() => {
        resetWrite?.();
      }, 100);
    }
  }, [isReceiptError, resetWrite]);

  const handleBorrow = async () => {
    if (!amount || parseFloat(amount) <= 0 || !address || !isConnected) {
      return;
    }

    setIsProcessing(true);
    setTransactionError(null);
    setLastSubmittedAmount(amount);

    try {
      // Convert amount to token units
      const amountInWei = parseUnits(amount, asset.decimals);
      console.log('🔐 Borrow start:', {
        pool: POOL_ADDRESS,
        asset: asset.address,
        symbol: asset.symbol,
        decimals: asset.decimals,
        amount,
        amountInWei: amountInWei.toString(),
        user: address
      });

      // Get FHE instance
      const fheInstance = await getFHEInstance();

      // Create encrypted input bound to pool
      const input = (fheInstance as any).createEncryptedInput(
        POOL_ADDRESS as `0x${string}`,
        address as `0x${string}`
      );

      // Add amount as encrypted value (64-bit)
      input.add64(amountInWei);

      const encryptedAmount = await input.encrypt();

      // Normalize encrypted payload to hex strings for contract call
      const toHex = (v: any): `0x${string}` => {
        if (v instanceof Uint8Array) {
          return ('0x' + Array.from(v).map((b: number) => b.toString(16).padStart(2, '0')).join('')) as `0x${string}`;
        }
        if (typeof v === 'string') {
          return v.startsWith('0x') ? (v as `0x${string}`) : ('0x' + v) as `0x${string}`;
        }
        throw new Error('Unsupported encrypted payload type');
      };

      const formattedEncryptedAmount = toHex(encryptedAmount.handles?.[0]);
      const formattedInputProof = toHex(encryptedAmount.inputProof);
      console.log('🧮 Encrypted payload:', {
        handle: formattedEncryptedAmount,
        inputProofLength: formattedInputProof.length
      });

      // Debug: show borrow call parameters (non-sensitive)
      console.log('📦 Borrow tx params:', {
        poolAddress: POOL_ADDRESS,
        assetAddress: asset.address,
        assetSymbol: asset.symbol,
        assetDecimals: asset.decimals,
        amountInput: amount,
        amountInWei: amountInWei.toString(),
        encryptedHandle: formattedEncryptedAmount,
        inputProofLength: formattedInputProof.length
      });

      // Call Pool.borrow() with async to surface hash/errors immediately
      const txHash = await writeContractAsync({
        address: POOL_ADDRESS,
        abi: POOL_ABI,
        functionName: 'borrow',
        args: [
          asset.address as `0x${string}`,
          formattedEncryptedAmount,
          formattedInputProof,
        ],
      });
      console.log('✅ Borrow submitted:', txHash);
    } catch (error: any) {
      console.error('Borrow error:', error);
      setTransactionError(error.message || 'Failed to borrow');
      setIsProcessing(false);
    }
  };

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
        onClick={() => {
          // Close the dialog by triggering a custom event or using parent component logic
          const event = new CustomEvent('closeBorrowDialog');
          window.dispatchEvent(event);
        }}
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
          Borrow {asset.symbol}
        </Typography>
      </Box>

      {/* Amount Input */}
      <Box sx={{ mb: 1 }}>
        <TextField
          fullWidth
          label="Borrow Amount"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={isPending || isConfirming || isProcessing}
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
                onClick={() => {
                  // For borrow, we can't set MAX since we don't know available collateral
                  // This would need to be calculated based on collateral value and LTV
                  console.log('MAX button: Not implemented for borrow form');
                }}
                disabled={true}
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
            `Available: Based on collateral and LTV ratio`
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
            Successfully borrowed {lastSubmittedAmount} {asset.symbol}!
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
            Transaction cancelled by user. No funds were borrowed.
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
            Loading...
          </Typography>
        </Box>

        <Divider sx={{ my: 0.5 }} />

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'sans-serif' }}>Total</Typography>
          <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'sans-serif' }}>
            {amount ? `${parseFloat(amount).toFixed(asset.decimals === 6 ? 2 : 4)} ${asset.symbol}` : `0.${'0'.repeat(asset.decimals === 6 ? 2 : 4)} ${asset.symbol}`}
          </Typography>
        </Box>
      </Box>

      {/* Submit Button */}
      <Button
        fullWidth
        variant="contained"
        size="medium"
        onClick={handleBorrow}
        disabled={
          !amount ||
          parseFloat(amount) <= 0 ||
          isPending ||
          isConfirming ||
          isProcessing ||
          !isConnected
        }
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
        {isPending || isConfirming || isProcessing
          ? 'Processing...'
          : !isConnected
          ? 'Connect Wallet'
          : `Borrow ${asset.symbol}`}
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
