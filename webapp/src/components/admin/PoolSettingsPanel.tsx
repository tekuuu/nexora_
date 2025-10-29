'use client';

import { useState, useEffect } from 'react';
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material';
import { SettingsEthernet, Save, Pause, PlayArrow } from '@mui/icons-material';
import { ADMIN_CONTRACTS } from '@/config/admin/adminContracts';
import { POOL_ABI } from '@/config/poolABI';

export default function PoolSettingsPanel() {
  const [configuratorInput, setConfiguratorInput] = useState('');
  const [oracleInput, setOracleInput] = useState('');

  const { data: configuratorAddr, refetch: refetchConfigurator } = useReadContract({
    address: ADMIN_CONTRACTS.LENDING_POOL as `0x${string}`,
    abi: POOL_ABI,
    functionName: 'configurator',
  });

  const { data: oracleAddr, refetch: refetchOracle } = useReadContract({
    address: ADMIN_CONTRACTS.LENDING_POOL as `0x${string}`,
    abi: POOL_ABI,
    functionName: 'priceOracle',
  });

  const { data: isPaused, refetch: refetchPaused } = useReadContract({
    address: ADMIN_CONTRACTS.LENDING_POOL as `0x${string}`,
    abi: POOL_ABI,
    functionName: 'paused',
  });

  useEffect(() => {
    if (configuratorAddr) setConfiguratorInput(configuratorAddr as string);
  }, [configuratorAddr]);

  useEffect(() => {
    if (oracleAddr) setOracleInput(oracleAddr as string);
  }, [oracleAddr]);

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const handleSetConfigurator = () => {
    if (!configuratorInput) return;
    writeContract({
      address: ADMIN_CONTRACTS.LENDING_POOL as `0x${string}`,
      abi: POOL_ABI,
      functionName: 'setConfigurator',
      args: [configuratorInput as `0x${string}`],
      gas: BigInt(200000),
    });
  };

  const handleSetOracle = () => {
    if (!oracleInput) return;
    writeContract({
      address: ADMIN_CONTRACTS.LENDING_POOL as `0x${string}`,
      abi: POOL_ABI,
      functionName: 'setPriceOracle',
      args: [oracleInput as `0x${string}`],
      gas: BigInt(200000),
    });
  };

  const handlePause = () => {
    writeContract({
      address: ADMIN_CONTRACTS.LENDING_POOL as `0x${string}`,
      abi: POOL_ABI,
      functionName: 'pause',
      args: [],
      gas: BigInt(150000),
    });
  };

  const handleUnpause = () => {
    writeContract({
      address: ADMIN_CONTRACTS.LENDING_POOL as `0x${string}`,
      abi: POOL_ABI,
      functionName: 'unpause',
      args: [],
      gas: BigInt(150000),
    });
  };

  useEffect(() => {
    if (isSuccess) {
      refetchConfigurator();
      refetchOracle();
      refetchPaused();
    }
  }, [isSuccess, refetchConfigurator, refetchOracle, refetchPaused]);

  return (
    <Card sx={{ background: 'rgba(255, 255, 255, 0.05)', backdropFilter: 'blur(10px)' }}>
      <CardContent>
        <Typography variant="h5" gutterBottom sx={{ color: 'white', mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
          <SettingsEthernet /> Pool Settings
        </Typography>

        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2" sx={{ color: 'white' }}>
            Configure the pool's core dependencies. Only POOL_ADMIN can update these addresses.
          </Typography>
        </Alert>

        <Grid container spacing={3}>
          {/* Protocol status */}
          <Grid item xs={12}>
            <Alert severity={isPaused ? 'error' : 'success'} sx={{ mb: 1 }}>
              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                Protocol Status: {isPaused ? '🔴 PAUSED' : '🟢 RUNNING'}
              </Typography>
            </Alert>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="contained"
                color="error"
                onClick={handlePause}
                disabled={isPending || isConfirming || Boolean(isPaused)}
                startIcon={<Pause />}
              >
                Pause Protocol
              </Button>
              <Button
                variant="contained"
                color="success"
                onClick={handleUnpause}
                disabled={isPending || isConfirming || !Boolean(isPaused)}
                startIcon={<PlayArrow />}
              >
                Unpause Protocol
              </Button>
            </Box>
          </Grid>

          <Grid item xs={12}>
            <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.1)' }} />
          </Grid>
          {/* Configurator */}
          <Grid item xs={12}>
            <Typography variant="subtitle2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1 }}>
              Current Configurator
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                fullWidth
                value={configuratorInput}
                onChange={(e) => setConfiguratorInput(e.target.value)}
                placeholder="0x..."
                sx={{
                  '& .MuiInputBase-input': { color: 'white', fontFamily: 'monospace' },
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.3)' },
                }}
              />
              <Button
                variant="contained"
                onClick={handleSetConfigurator}
                disabled={isPending || isConfirming || !configuratorInput}
                startIcon={isPending || isConfirming ? <CircularProgress size={20} /> : <Save />}
              >
                Save
              </Button>
            </Box>
          </Grid>

          <Grid item xs={12}>
            <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.1)' }} />
          </Grid>

          {/* Oracle */}
          <Grid item xs={12}>
            <Typography variant="subtitle2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1 }}>
              Current Price Oracle
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                fullWidth
                value={oracleInput}
                onChange={(e) => setOracleInput(e.target.value)}
                placeholder="0x..."
                sx={{
                  '& .MuiInputBase-input': { color: 'white', fontFamily: 'monospace' },
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.3)' },
                }}
              />
              <Button
                variant="contained"
                onClick={handleSetOracle}
                disabled={isPending || isConfirming || !oracleInput}
                startIcon={isPending || isConfirming ? <CircularProgress size={20} /> : <Save />}
              >
                Save
              </Button>
            </Box>
          </Grid>

          {isSuccess && (
            <Grid item xs={12}>
              <Alert severity="success">Settings updated successfully.</Alert>
            </Grid>
          )}
        </Grid>
      </CardContent>
    </Card>
  );
}


