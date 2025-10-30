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
} from '@mui/material';
import { TrendingDown, Close } from '@mui/icons-material';
import { getFHEInstance } from '../utils/fhe';
import { parseTransactionError } from '../utils/errorHandling';

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

  const { writeContract, writeContractAsync, data: hash, isPending, error: writeError, reset: resetWrite } = useWriteContract();
  const { isLoading: isConfirming, isSuccess, isError: isReceiptError } = useWaitForTransactionReceipt({ hash });

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
    if (isSuccess) {
      // Ensure UI stops spinning when tx is confirmed
      setIsProcessing(false);
      setAmount('');
      if (onTransactionSuccess) {
        onTransactionSuccess();
      }
      // Clear wagmi write state shortly after success so UI doesn't stay stuck
      setTimeout(() => {
        resetWrite?.();
      }, 100);

      setTimeout(() => {
        if (onClose) onClose();
      }, 2000);
    }
  }, [isSuccess, onTransactionSuccess, onClose, resetWrite]);

  // Handle errors
  useEffect(() => {
    if (writeError) {
      const msg = writeError.message?.toLowerCase?.() || '';
      console.error('Borrow write error:', writeError);
      if (msg.includes('user rejected') || msg.includes('user denied') || msg.includes('rejected the request')) {
        setTransactionError('Transaction cancelled by user');
      } else {
        setTransactionError(parseTransactionError(writeError));
      }
      setIsProcessing(false);

      // Clear wagmi write state to unblock the UI
      setTimeout(() => {
        resetWrite?.();
      }, 100);
    }
  }, [writeError, resetWrite]);

  // Handle on-chain receipt failures
  useEffect(() => {
    if (isReceiptError) {
      setTransactionError(parseTransactionError(new Error('Transaction reverted on-chain')));
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
        pool: CONTRACTS.LENDING_POOL,
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
        CONTRACTS.LENDING_POOL as `0x${string}`,
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
        poolAddress: CONTRACTS.LENDING_POOL,
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
        address: CONTRACTS.LENDING_POOL as `0x${string}`,
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
      setTransactionError(parseTransactionError(error));
      setIsProcessing(false);
    }
  };

  return (
    <Card
      sx={{
        maxWidth: 420,
        color: 'white',
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      }}
    >
      <CardContent sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
            <TrendingDown />
            Borrow {asset.symbol}
          </Typography>
          {onClose && (
            <Button
              onClick={onClose}
              sx={{ minWidth: 'auto', p: 0.5, color: 'white' }}
            >
              <Close />
            </Button>
          )}
        </Box>

        {/* Amount Input */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2">Amount</Typography>
          </Box>
          <TextField
            fullWidth
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            sx={{
              '& .MuiInputBase-root': {
                color: 'white',
                background: 'rgba(255, 255, 255, 0.05)',
                fontSize: '1.25rem',
                fontWeight: 600,
              },
              '& .MuiInputBase-input': {
                textAlign: 'right',
              },
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: 'rgba(255, 255, 255, 0.2)',
              },
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: 'rgba(255, 255, 255, 0.4)',
              },
            }}
            InputProps={{
              endAdornment: (
                <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', ml: 1 }}>
                  {asset.symbol}
                </Typography>
              ),
            }}
          />
        </Box>

        {/* Transaction Error */}
        {transactionError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {transactionError}
          </Alert>
        )}

        {/* Success Message */}
        {isSuccess && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Successfully borrowed {lastSubmittedAmount} {asset.symbol}!
          </Alert>
        )}

        {/* Borrow Button */}
        <Button
          fullWidth
          variant="contained"
          size="large"
          onClick={handleBorrow}
          disabled={
            !amount ||
            parseFloat(amount) <= 0 ||
            isPending ||
            isConfirming ||
            isProcessing ||
            !isConnected
          }
          startIcon={isPending || isConfirming || isProcessing ? <CircularProgress size={20} /> : <TrendingDown />}
          sx={{
            py: 1.25,
            background: 'linear-gradient(135deg, #9c27b0 0%, #7b1fa2 100%)',
            fontSize: '1rem',
            fontWeight: 600,
            textTransform: 'none',
            '&:hover': {
              background: 'linear-gradient(135deg, #7b1fa2 0%, #6a1b9a 100%)',
            },
            '&:disabled': {
              background: 'rgba(255, 255, 255, 0.1)',
              color: 'rgba(255, 255, 255, 0.3)',
            },
          }}
        >
          {isPending || isConfirming || isProcessing
            ? 'Processing...'
            : !isConnected
            ? 'Connect Wallet'
            : `Borrow ${asset.symbol}`}
        </Button>
      </CardContent>
    </Card>
  );
}
