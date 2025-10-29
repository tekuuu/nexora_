'use client';

import { useState, useEffect } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Grid,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
} from '@mui/material';
import { Pause, PlayArrow, Warning } from '@mui/icons-material';
import { ADMIN_CONTRACTS, RESERVE_TOKENS } from '@/config/admin/adminContracts';
import { CONFIGURATOR_ABI } from '@/config/admin/adminABI';

export default function EmergencyPanel() {
  const [selectedAsset, setSelectedAsset] = useState<string>(RESERVE_TOKENS[0].address as string);

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const { data: reserveData, refetch } = useReadContract({
    address: ADMIN_CONTRACTS.POOL_CONFIGURATOR as `0x${string}`,
    abi: CONFIGURATOR_ABI,
    functionName: 'getReserveConfig',
    args: [selectedAsset as `0x${string}`],
  });

  const handlePause = () => {
    writeContract({
      address: ADMIN_CONTRACTS.POOL_CONFIGURATOR as `0x${string}`,
      abi: CONFIGURATOR_ABI,
      functionName: 'pauseReserve',
      args: [selectedAsset as `0x${string}`],
      gas: BigInt(300000),
    });
  };

  const handleUnpause = () => {
    writeContract({
      address: ADMIN_CONTRACTS.POOL_CONFIGURATOR as `0x${string}`,
      abi: CONFIGURATOR_ABI,
      functionName: 'unpauseReserve',
      args: [selectedAsset as `0x${string}`],
      gas: BigInt(300000),
    });
  };

  useEffect(() => {
    if (isSuccess) {
      refetch();
    }
  }, [isSuccess, refetch]);

  const reserve = reserveData as { isPaused?: boolean } | undefined;
  const isPaused = reserve?.isPaused || false;
  const selectedToken = RESERVE_TOKENS.find(t => t.address === selectedAsset);

  return (
    <Card sx={{ background: 'rgba(255, 255, 255, 0.05)', backdropFilter: 'blur(10px)' }}>
      <CardContent>
        <Typography variant="h5" gutterBottom sx={{ color: 'white', mb: 3 }}>
          🚨 Emergency Controls
        </Typography>

        <Grid container spacing={3}>
          {/* Warning */}
          <Grid item xs={12}>
            <Alert 
              severity="error"
              icon={<Warning />}
              sx={{ 
                background: 'rgba(244, 67, 54, 0.1)',
                border: '1px solid rgba(244, 67, 54, 0.3)',
              }}
            >
              <Typography variant="body2" sx={{ color: 'white' }}>
                <strong>⚠️ Use with caution!</strong> Pausing a reserve stops all operations (supply, borrow, withdraw, repay) for that asset. Existing positions remain safe.
              </Typography>
            </Alert>
          </Grid>

          {/* Asset Selection */}
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>Select Reserve</InputLabel>
              <Select
                value={selectedAsset}
                label="Select Reserve"
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

          {/* Status Display */}
          <Grid item xs={12}>
            <Alert 
              severity={isPaused ? 'error' : 'success'}
              sx={{ 
                background: isPaused ? 'rgba(244, 67, 54, 0.1)' : 'rgba(76, 175, 80, 0.1)',
                border: isPaused ? '1px solid rgba(244, 67, 54, 0.3)' : '1px solid rgba(76, 175, 80, 0.3)',
              }}
            >
              <Typography variant="body1" sx={{ color: 'white', fontWeight: 600 }}>
                Current Status: <strong>{isPaused ? '🔴 PAUSED' : '🟢 RUNNING'}</strong>
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mt: 1 }}>
                Reserve: {selectedToken?.name} ({selectedToken?.address.slice(0, 10)}...)
              </Typography>
            </Alert>
          </Grid>

          {/* Action Buttons */}
          <Grid item xs={12} md={6}>
            <Button
              variant="contained"
              color="error"
              size="large"
              onClick={handlePause}
              disabled={isPending || isConfirming || isPaused}
              startIcon={<Pause />}
              fullWidth
              sx={{
                py: 1.5,
                background: isPaused ? 'rgba(255, 255, 255, 0.1)' : 'linear-gradient(135deg, #ff6b6b 0%, #c92a2a 100%)',
                '&:hover': {
                  background: isPaused ? 'rgba(255, 255, 255, 0.1)' : 'linear-gradient(135deg, #c92a2a 0%, #ff6b6b 100%)',
                },
              }}
            >
              {isPending || isConfirming ? <CircularProgress size={20} /> : 'Pause Reserve'}
            </Button>
          </Grid>

          <Grid item xs={12} md={6}>
            <Button
              variant="contained"
              color="success"
              size="large"
              onClick={handleUnpause}
              disabled={isPending || isConfirming || !isPaused}
              startIcon={<PlayArrow />}
              fullWidth
              sx={{
                py: 1.5,
                background: !isPaused ? 'rgba(255, 255, 255, 0.1)' : 'linear-gradient(135deg, #51cf66 0%, #2f9e44 100%)',
                '&:hover': {
                  background: !isPaused ? 'rgba(255, 255, 255, 0.1)' : 'linear-gradient(135deg, #2f9e44 0%, #51cf66 100%)',
                },
              }}
            >
              {isPending || isConfirming ? <CircularProgress size={20} /> : 'Unpause Reserve'}
            </Button>
          </Grid>

          {/* Success Message */}
          {isSuccess && (
            <Grid item xs={12}>
              <Alert severity="success">
                Reserve {isPaused ? 'unpaused' : 'paused'} successfully!
              </Alert>
            </Grid>
          )}
        </Grid>
      </CardContent>
    </Card>
  );
}


