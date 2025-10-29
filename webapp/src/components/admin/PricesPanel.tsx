'use client';

import { useState, useEffect } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Grid,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Divider,
} from '@mui/material';
import { AttachMoney, TrendingUp } from '@mui/icons-material';
import { ADMIN_CONTRACTS, RESERVE_TOKENS } from '@/config/admin/adminContracts';
import { ORACLE_ABI } from '@/config/admin/adminABI';

export default function PricesPanel() {
  const [selectedAsset, setSelectedAsset] = useState(RESERVE_TOKENS[0].address);
  const [priceUSD, setPriceUSD] = useState('');

  const { writeContract, data: hash, isPending, isSuccess: isWriteSuccess } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const { data: currentPrice, refetch: refetchPrice } = useReadContract({
    address: ADMIN_CONTRACTS.PRICE_ORACLE as `0x${string}`,
    abi: ORACLE_ABI,
    functionName: 'getPrice',
    args: [selectedAsset as `0x${string}`],
  });

  const selectedToken = RESERVE_TOKENS.find(t => t.address === selectedAsset);
  const currentPriceUSD = currentPrice ? Number(currentPrice) / 1e12 : 0;

  const handleUpdatePrice = async () => {
    if (!priceUSD) return;
    const priceInE12 = BigInt(Math.floor(parseFloat(priceUSD) * 1e12));

    writeContract({
      address: ADMIN_CONTRACTS.PRICE_ORACLE as `0x${string}`,
      abi: ORACLE_ABI,
      functionName: 'setPrice',
      args: [selectedAsset as `0x${string}`, priceInE12],
      gas: BigInt(500000),
    });
  };

  useEffect(() => {
    if (isSuccess) {
      refetchPrice();
      setPriceUSD('');
    }
  }, [isSuccess, refetchPrice]);

  return (
    <Card sx={{ background: 'rgba(255, 255, 255, 0.05)', backdropFilter: 'blur(10px)' }}>
      <CardContent>
        <Typography variant="h5" gutterBottom sx={{ color: 'white', mb: 3 }}>
          💰 Update Asset Prices
        </Typography>

        <Grid container spacing={3}>
          {/* Asset Selection */}
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>Select Asset</InputLabel>
              <Select
                value={selectedAsset}
                label="Select Asset"
                onChange={(e) => setSelectedAsset(e.target.value)}
                sx={{
                  color: 'white',
                  '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.3)' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.5)' },
                }}
              >
                {RESERVE_TOKENS.map((token) => (
                  <MenuItem key={token.address} value={token.address}>
                    {token.name} - {token.address.slice(0, 6)}...{token.address.slice(-4)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Current Price Display */}
          <Grid item xs={12}>
            <Alert 
              severity="info" 
              icon={<TrendingUp />}
              sx={{ 
                background: 'rgba(33, 150, 243, 0.1)',
                border: '1px solid rgba(33, 150, 243, 0.3)',
              }}
            >
              <Typography variant="body2" sx={{ color: 'white' }}>
                Current {selectedToken?.name} price: <strong>${currentPriceUSD.toLocaleString()}</strong>
              </Typography>
            </Alert>
          </Grid>

          {/* Price Input */}
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="New Price (USD)"
              type="number"
              value={priceUSD}
              onChange={(e) => setPriceUSD(e.target.value)}
              placeholder="2000"
              InputProps={{
                startAdornment: <AttachMoney sx={{ color: 'rgba(255, 255, 255, 0.5)', mr: 1 }} />,
              }}
              sx={{
                '& .MuiInputLabel-root': { color: 'rgba(255, 255, 255, 0.7)' },
                '& .MuiInputBase-input': { color: 'white' },
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.3)' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.5)' },
              }}
              helperText="Enter the new price in USD (e.g., 2000 for $2000)"
            />
          </Grid>

          {/* Submit Button */}
          <Grid item xs={12}>
            <Button
              variant="contained"
              color="primary"
              size="large"
              onClick={handleUpdatePrice}
              disabled={isPending || isConfirming || !priceUSD}
              startIcon={isPending || isConfirming ? <CircularProgress size={20} /> : <AttachMoney />}
              fullWidth
              sx={{
                py: 1.5,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)',
                },
              }}
            >
              {isPending ? 'Confirming...' : isConfirming ? 'Waiting for confirmation...' : 'Update Price'}
            </Button>
          </Grid>

          {/* Success Message */}
          {isSuccess && (
            <Grid item xs={12}>
              <Alert severity="success">
                Price updated successfully! New price: ${parseFloat(priceUSD).toLocaleString()}
              </Alert>
            </Grid>
          )}

          {/* Warning */}
          <Grid item xs={12}>
            <Alert 
              severity="warning"
              sx={{ 
                background: 'rgba(255, 152, 0, 0.1)',
                border: '1px solid rgba(255, 152, 0, 0.3)',
              }}
            >
              <Typography variant="body2">
                <strong>⚠️ Important:</strong> Price updates affect borrowing power immediately. Ensure prices are accurate to maintain protocol health.
              </Typography>
            </Alert>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}


