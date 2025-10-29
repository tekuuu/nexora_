'use client';

import { useState, useEffect } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { POOL_ABI } from '@/config/poolABI';
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
  Switch,
  FormControlLabel,
  Divider,
  Chip,
} from '@mui/material';
import { Settings, Save, Tune } from '@mui/icons-material';
import { ADMIN_CONTRACTS, RESERVE_TOKENS } from '@/config/admin/adminContracts';
import { CONFIGURATOR_ABI } from '@/config/admin/adminABI';

export default function ReserveConfigPanel() {
  const [selectedAsset, setSelectedAsset] = useState<string>(RESERVE_TOKENS[0].address);
  const [active, setActive] = useState(true);
  const [borrowingEnabled, setBorrowingEnabled] = useState(true);
  const [isCollateral, setIsCollateral] = useState(true);
  const [collateralFactor, setCollateralFactor] = useState('75');
  const [supplyCap, setSupplyCap] = useState('1000000');
  const [borrowCap, setBorrowCap] = useState('500000');

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const { data: reserveData, refetch } = useReadContract({
    address: ADMIN_CONTRACTS.POOL_CONFIGURATOR as `0x${string}`,
    abi: CONFIGURATOR_ABI,
    functionName: 'getReserveConfig',
    args: [selectedAsset as `0x${string}`],
  });

  const { data: poolReserveData } = useReadContract({
    address: ADMIN_CONTRACTS.LENDING_POOL as `0x${string}`,
    abi: POOL_ABI,
    functionName: 'getReserveData',
    args: [selectedAsset as `0x${string}`],
  });

  // Load current config when asset changes
  useEffect(() => {
    if (reserveData) {
      const reserve = reserveData as any;
      setActive(reserve.active || false);
      setBorrowingEnabled(reserve.borrowingEnabled || false);
      setIsCollateral(reserve.isCollateral || false);
      setCollateralFactor(reserve.collateralFactor ? (Number(reserve.collateralFactor) / 1e12 * 100).toFixed(0) : '75');
      setSupplyCap(reserve.supplyCap ? (Number(reserve.supplyCap) / 1e12).toFixed(0) : '1000000');
      setBorrowCap(reserve.borrowCap ? (Number(reserve.borrowCap) / 1e12).toFixed(0) : '500000');
    }
  }, [reserveData, selectedAsset]);

  useEffect(() => {
    if (isSuccess) {
      refetch();
    }
  }, [isSuccess, refetch]);

  const handleSetActive = () => {
    writeContract({
      address: ADMIN_CONTRACTS.POOL_CONFIGURATOR as `0x${string}`,
      abi: CONFIGURATOR_ABI,
      functionName: 'setReserveActive',
      args: [selectedAsset as `0x${string}`, !active],
      gas: BigInt(300000),
    });
  };

  const handleSetBorrowing = () => {
    writeContract({
      address: ADMIN_CONTRACTS.POOL_CONFIGURATOR as `0x${string}`,
      abi: CONFIGURATOR_ABI,
      functionName: 'setReserveBorrowing',
      args: [selectedAsset as `0x${string}`, !borrowingEnabled],
      gas: BigInt(300000),
    });
  };

  const handleSetCollateral = () => {
    writeContract({
      address: ADMIN_CONTRACTS.POOL_CONFIGURATOR as `0x${string}`,
      abi: CONFIGURATOR_ABI,
      functionName: 'setReserveCollateral',
      args: [selectedAsset as `0x${string}`, !isCollateral],
      gas: BigInt(300000),
    });
  };

  const handleSetCollateralFactor = () => {
    const factorInE12 = BigInt(Math.floor(parseFloat(collateralFactor) * 1e10));
    writeContract({
      address: ADMIN_CONTRACTS.POOL_CONFIGURATOR as `0x${string}`,
      abi: CONFIGURATOR_ABI,
      functionName: 'setCollateralFactor',
      args: [selectedAsset as `0x${string}`, factorInE12],
      gas: BigInt(300000),
    });
  };

  const handleSetSupplyCap = () => {
    const capInE12 = BigInt(Math.floor(parseFloat(supplyCap) * 1e12));
    writeContract({
      address: ADMIN_CONTRACTS.POOL_CONFIGURATOR as `0x${string}`,
      abi: CONFIGURATOR_ABI,
      functionName: 'setSupplyCap',
      args: [selectedAsset as `0x${string}`, capInE12],
      gas: BigInt(300000),
    });
  };

  const handleSetBorrowCap = () => {
    const capInE12 = BigInt(Math.floor(parseFloat(borrowCap) * 1e12));
    writeContract({
      address: ADMIN_CONTRACTS.POOL_CONFIGURATOR as `0x${string}`,
      abi: CONFIGURATOR_ABI,
      functionName: 'setBorrowCap',
      args: [selectedAsset as `0x${string}`, capInE12],
      gas: BigInt(300000),
    });
  };

  const selectedToken = RESERVE_TOKENS.find(t => t.address === selectedAsset);

  const poolReserve = poolReserveData as any;
  const isInitialized = !!(poolReserve && poolReserve.underlyingAsset && poolReserve.underlyingAsset !== '0x0000000000000000000000000000000000000000');

  return (
    <Card sx={{ background: 'rgba(255, 255, 255, 0.05)', backdropFilter: 'blur(10px)' }}>
      <CardContent>
        <Typography variant="h5" gutterBottom sx={{ color: 'white', mb: 3 }}>
          ⚙️ Reserve Configuration
        </Typography>

        <Grid container spacing={3}>
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

          <Grid item xs={12}>
            <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.1)', my: 2 }} />
            <Typography variant="h6" sx={{ color: 'white', mb: 2 }}>
              Current Configuration
            </Typography>
            {!isInitialized && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                This reserve is not initialized on the Pool. Initialize it in the Add Reserve tab before changing parameters or allowing supply.
              </Alert>
            )}
          </Grid>

          {/* Toggle: Active/Inactive */}
          <Grid item xs={12} md={6}>
            <Card sx={{ background: 'rgba(0, 0, 0, 0.2)', p: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                    Reserve Status
                  </Typography>
                  <Chip 
                    label={active ? 'Active' : 'Inactive'} 
                    color={active ? 'success' : 'default'} 
                    size="small"
                    sx={{ mt: 1 }}
                  />
                </Box>
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleSetActive}
                  disabled={isPending || isConfirming || !isInitialized}
                  sx={{ minWidth: 100 }}
                >
                  {active ? 'Deactivate' : 'Activate'}
                </Button>
              </Box>
            </Card>
          </Grid>

          {/* Toggle: Borrowing */}
          <Grid item xs={12} md={6}>
            <Card sx={{ background: 'rgba(0, 0, 0, 0.2)', p: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                    Borrowing
                  </Typography>
                  <Chip 
                    label={borrowingEnabled ? 'Enabled' : 'Disabled'} 
                    color={borrowingEnabled ? 'primary' : 'default'} 
                    size="small"
                    sx={{ mt: 1 }}
                  />
                </Box>
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleSetBorrowing}
                  disabled={isPending || isConfirming || !isInitialized}
                  sx={{ minWidth: 100 }}
                >
                  {borrowingEnabled ? 'Disable' : 'Enable'}
                </Button>
              </Box>
            </Card>
          </Grid>

          {/* Toggle: Collateral */}
          <Grid item xs={12} md={6}>
            <Card sx={{ background: 'rgba(0, 0, 0, 0.2)', p: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                    Can Be Collateral
                  </Typography>
                  <Chip 
                    label={isCollateral ? 'Yes' : 'No'} 
                    color={isCollateral ? 'info' : 'default'} 
                    size="small"
                    sx={{ mt: 1 }}
                  />
                </Box>
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleSetCollateral}
                  disabled={isPending || isConfirming || !isInitialized}
                  sx={{ minWidth: 100 }}
                >
                  {isCollateral ? 'Disable' : 'Enable'}
                </Button>
              </Box>
            </Card>
          </Grid>

          {/* Collateral Factor */}
          <Grid item xs={12} md={6}>
            <Card sx={{ background: 'rgba(0, 0, 0, 0.2)', p: 2 }}>
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1 }}>
                Collateral Factor (LTV %)
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <TextField
                  size="small"
                  type="number"
                  value={collateralFactor}
                  onChange={(e) => setCollateralFactor(e.target.value)}
                  sx={{
                    flex: 1,
                    '& .MuiInputBase-input': { color: 'white' },
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.3)' },
                  }}
                  InputProps={{ endAdornment: '%' }}
                />
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleSetCollateralFactor}
                  disabled={isPending || isConfirming || !isInitialized}
                >
                  Update
                </Button>
              </Box>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.1)', my: 2 }} />
            <Typography variant="h6" sx={{ color: 'white', mb: 2 }}>
              Risk Parameters
            </Typography>
          </Grid>

          {/* Supply Cap */}
          <Grid item xs={12} md={6}>
            <Card sx={{ background: 'rgba(0, 0, 0, 0.2)', p: 2 }}>
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1 }}>
                Supply Cap (Max Total Supply)
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <TextField
                  size="small"
                  type="number"
                  value={supplyCap}
                  onChange={(e) => setSupplyCap(e.target.value)}
                  sx={{
                    flex: 1,
                    '& .MuiInputBase-input': { color: 'white' },
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.3)' },
                  }}
                  helperText="0 = unlimited"
                />
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleSetSupplyCap}
                  disabled={isPending || isConfirming}
                >
                  Update
                </Button>
              </Box>
            </Card>
          </Grid>

          {/* Borrow Cap */}
          <Grid item xs={12} md={6}>
            <Card sx={{ background: 'rgba(0, 0, 0, 0.2)', p: 2 }}>
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1 }}>
                Borrow Cap (Max Total Borrowed)
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <TextField
                  size="small"
                  type="number"
                  value={borrowCap}
                  onChange={(e) => setBorrowCap(e.target.value)}
                  sx={{
                    flex: 1,
                    '& .MuiInputBase-input': { color: 'white' },
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.3)' },
                  }}
                  helperText="0 = unlimited"
                />
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleSetBorrowCap}
                  disabled={isPending || isConfirming}
                >
                  Update
                </Button>
              </Box>
            </Card>
          </Grid>

          {/* Success Message */}
          {isSuccess && (
            <Grid item xs={12}>
              <Alert severity="success">
                Reserve configuration updated successfully!
              </Alert>
            </Grid>
          )}

          {/* Info */}
          <Grid item xs={12}>
            <Alert 
              severity="info"
              sx={{ 
                background: 'rgba(33, 150, 243, 0.1)',
                border: '1px solid rgba(33, 150, 243, 0.3)',
              }}
            >
              <Typography variant="body2" sx={{ color: 'white' }}>
                <strong>💡 Tip:</strong> Changes take effect immediately. Active status controls all operations. Borrowing and Collateral flags control specific features.
              </Typography>
            </Alert>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}

