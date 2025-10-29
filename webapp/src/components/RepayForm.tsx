'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { POOL_ABI } from '../config/poolABI';
import { getFHEInstance } from '../utils/fhe';
import { getSafeContractAddresses } from '../config/contractConfig';
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
} from '@mui/material';
import { Send, Close } from '@mui/icons-material';

interface RepayFormProps {
  onTransactionSuccess?: () => void;
  onClose?: () => void;
  selectedAsset?: {
    address: string;
    symbol: string;
    decimals: number;
    price?: number;
  };
}

export default function RepayForm({
  onTransactionSuccess,
  onClose,
  selectedAsset,
}: RepayFormProps) {
  const { address, isConnected } = useAccount();

  const [amount, setAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [transactionError, setTransactionError] = useState<string | null>(null);

  const { writeContract, data: hash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  // Resolve Pool address safely
  const contractAddresses = getSafeContractAddresses();
  const POOL_ADDRESS = (contractAddresses?.POOL_ADDRESS || CONTRACTS.LENDING_POOL) as `0x${string}`;

  // Default to cUSDC if no asset provided
  const asset = selectedAsset || {
    address: CONTRACTS.CONFIDENTIAL_USDC,
    symbol: 'cUSDC',
    decimals: 6,
    price: 1,
  };

  // Handle successful transaction
  useEffect(() => {
    if (isSuccess) {
      setAmount('');
      if (onTransactionSuccess) onTransactionSuccess();
      setTimeout(() => {
        if (onClose) onClose();
      }, 1500);
    }
  }, [isSuccess, onTransactionSuccess, onClose]);

  // Handle write errors
  useEffect(() => {
    if (writeError) {
      setTransactionError(writeError.message || 'Transaction failed');
      setIsProcessing(false);
    }
  }, [writeError]);

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
    if (!amount || !address || !isConnected) return;

    setIsProcessing(true);
    setTransactionError(null);

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
        gas: BigInt(1000000),
      });
    } catch (err: any) {
      console.error('Repay error:', err);
      setTransactionError(err.message || 'Failed to repay');
      setIsProcessing(false);
    }
  };

  const disabled =
    !amount ||
    parseFloat(amount) <= 0 ||
    isPending ||
    isConfirming ||
    isProcessing ||
    !isConnected;

  return (
    <Card
      sx={{
        maxWidth: 500,
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        color: 'white',
        borderRadius: '16px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        position: 'relative',
      }}
    >
      <CardContent sx={{ p: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Send />
            Repay {asset.symbol}
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

        <Divider sx={{ mb: 3, borderColor: 'rgba(255, 255, 255, 0.1)' }} />

        {/* Amount Input */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2">Amount to Repay</Typography>
            {/* Optionally add MAX logic in future when borrowed balance is available */}
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
                fontSize: '1.5rem',
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
              '& .MuiFormHelperText-root': {
                color: 'rgba(255, 255, 255, 0.6)',
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

          {amount && parseFloat(amount) > 0 && (
            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.6)', mt: 1, display: 'block' }}>
              ≈ ${(parseFloat(amount) * (asset.price ?? 1)).toFixed(asset.decimals === 6 ? 2 : 6)} USD
            </Typography>
          )}
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
            Successfully repaid {amount} {asset.symbol}!
          </Alert>
        )}

        {/* Repay Button */}
        <Button
          fullWidth
          variant="contained"
          size="large"
          onClick={handleRepay}
          disabled={disabled}
          startIcon={(isPending || isConfirming || isProcessing) ? <CircularProgress size={20} /> : <Send />}
          sx={{
            py: 1.5,
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
          {(isPending || isConfirming || isProcessing)
            ? 'Processing...'
            : !isConnected
              ? 'Connect Wallet'
              : `Repay ${asset.symbol}`}
        </Button>

        {/* Info */}
        <Box sx={{ mt: 3 }}>
          <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.6)', display: 'block', mb: 1 }}>
            • Repayment reduces your outstanding debt for {asset.symbol}
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.6)', display: 'block' }}>
            • Ensure you have enough {asset.symbol} balance to repay
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}
