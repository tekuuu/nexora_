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
  CircularProgress,
} from '@mui/material';
import { Security, PersonAdd } from '@mui/icons-material';
import { ADMIN_CONTRACTS } from '@/config/admin/adminContracts';
import { ACL_MANAGER_ABI } from '@/config/admin/adminABI';

export default function RolesPanel() {
  const [newAdminAddress, setNewAdminAddress] = useState('');

  const { writeContract, data: hash, isPending, isSuccess: isWriteSuccess } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const { data: poolAdminRole } = useReadContract({
    address: ADMIN_CONTRACTS.ACL_MANAGER as `0x${string}`,
    abi: ACL_MANAGER_ABI,
    functionName: 'POOL_ADMIN',
  });

  const handleGrantRole = async () => {
    if (!newAdminAddress || !poolAdminRole) return;

    writeContract({
      address: ADMIN_CONTRACTS.ACL_MANAGER as `0x${string}`,
      abi: ACL_MANAGER_ABI,
      functionName: 'grantRole',
      args: [poolAdminRole as `0x${string}`, newAdminAddress as `0x${string}`],
      gas: BigInt(300000),
    });
  };

  useEffect(() => {
    if (isSuccess) {
      setNewAdminAddress('');
    }
  }, [isSuccess]);

  return (
    <Card sx={{ background: 'rgba(255, 255, 255, 0.05)', backdropFilter: 'blur(10px)' }}>
      <CardContent>
        <Typography variant="h5" gutterBottom sx={{ color: 'white', mb: 3 }}>
          👥 Role Management
        </Typography>

        <Grid container spacing={3}>
          {/* Info */}
          <Grid item xs={12}>
            <Alert 
              severity="info"
              icon={<Security />}
              sx={{ 
                background: 'rgba(33, 150, 243, 0.1)',
                border: '1px solid rgba(33, 150, 243, 0.3)',
              }}
            >
              <Typography variant="body2" sx={{ color: 'white' }}>
                POOL_ADMIN role grants full access to reserve management, price updates, and emergency controls.
              </Typography>
            </Alert>
          </Grid>

          {/* Address Input */}
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Address to Grant POOL_ADMIN Role"
              value={newAdminAddress}
              onChange={(e) => setNewAdminAddress(e.target.value)}
              placeholder="0x..."
              sx={{
                '& .MuiInputLabel-root': { color: 'rgba(255, 255, 255, 0.7)' },
                '& .MuiInputBase-input': { color: 'white', fontFamily: 'monospace' },
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.3)' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.5)' },
              }}
              helperText="The address that will receive POOL_ADMIN permissions"
            />
          </Grid>

          {/* Grant Button */}
          <Grid item xs={12}>
            <Button
              variant="contained"
              color="secondary"
              size="large"
              onClick={handleGrantRole}
              disabled={isPending || isConfirming || !newAdminAddress}
              startIcon={isPending || isConfirming ? <CircularProgress size={20} /> : <PersonAdd />}
              fullWidth
              sx={{
                py: 1.5,
                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #f5576c 0%, #f093fb 100%)',
                },
              }}
            >
              {isPending ? 'Confirming...' : isConfirming ? 'Waiting...' : 'Grant POOL_ADMIN Role'}
            </Button>
          </Grid>

          {/* Success Message */}
          {isSuccess && (
            <Grid item xs={12}>
              <Alert severity="success">
                POOL_ADMIN role granted successfully to {newAdminAddress.slice(0, 6)}...{newAdminAddress.slice(-4)}!
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
                <strong>⚠️ Warning:</strong> Only grant POOL_ADMIN to trusted addresses. They will have full control over reserve configuration and emergency functions.
              </Typography>
            </Alert>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}


