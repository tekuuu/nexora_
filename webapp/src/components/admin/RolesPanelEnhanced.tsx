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
  Tabs,
  Tab,
  Divider,
  Chip,
} from '@mui/material';
import { Security, PersonAdd, PersonRemove, AdminPanelSettings, Warning, Shield } from '@mui/icons-material';
import { ADMIN_CONTRACTS } from '@/config/admin/adminContracts';
import { ACL_MANAGER_ABI } from '@/config/admin/adminABI';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index } = props;
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

function RoleManagementTab({ roleType, roleLabel, roleIcon }: { roleType: 'POOL_ADMIN' | 'EMERGENCY_ADMIN' | 'RISK_ADMIN', roleLabel: string, roleIcon: React.ReactNode }) {
  const [grantAddress, setGrantAddress] = useState('');
  const [revokeAddress, setRevokeAddress] = useState('');

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const { data: roleHash } = useReadContract({
    address: ADMIN_CONTRACTS.ACL_MANAGER as `0x${string}`,
    abi: ACL_MANAGER_ABI,
    functionName: roleType,
  });

  const handleGrant = () => {
    if (!grantAddress || !roleHash) return;
    writeContract({
      address: ADMIN_CONTRACTS.ACL_MANAGER as `0x${string}`,
      abi: ACL_MANAGER_ABI,
      functionName: 'grantRole',
      args: [roleHash as `0x${string}`, grantAddress as `0x${string}`],
      gas: BigInt(300000),
    });
  };

  const handleRevoke = () => {
    if (!revokeAddress || !roleHash) return;
    writeContract({
      address: ADMIN_CONTRACTS.ACL_MANAGER as `0x${string}`,
      abi: ACL_MANAGER_ABI,
      functionName: 'revokeRole',
      args: [roleHash as `0x${string}`, revokeAddress as `0x${string}`],
      gas: BigInt(300000),
    });
  };

  useEffect(() => {
    if (isSuccess) {
      setGrantAddress('');
      setRevokeAddress('');
    }
  }, [isSuccess]);

  return (
    <Grid container spacing={3}>
      {/* Role Description */}
      <Grid item xs={12}>
        <Alert 
          severity="info"
          icon={roleIcon}
          sx={{ 
            background: 'rgba(33, 150, 243, 0.1)',
            border: '1px solid rgba(33, 150, 243, 0.3)',
          }}
        >
          <Typography variant="body2" sx={{ color: 'white' }}>
            <strong>{roleLabel}</strong>: {getRoleDescription(roleType)}
          </Typography>
        </Alert>
      </Grid>

      {/* Grant Role */}
      <Grid item xs={12}>
        <Card sx={{ background: 'rgba(76, 175, 80, 0.1)', border: '1px solid rgba(76, 175, 80, 0.3)' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ color: 'white', display: 'flex', alignItems: 'center', gap: 1 }}>
              <PersonAdd /> Grant {roleLabel}
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Address"
                  value={grantAddress}
                  onChange={(e) => setGrantAddress(e.target.value)}
                  placeholder="0x..."
                  sx={{
                    '& .MuiInputLabel-root': { color: 'rgba(255, 255, 255, 0.7)' },
                    '& .MuiInputBase-input': { color: 'white', fontFamily: 'monospace' },
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.3)' },
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <Button
                  variant="contained"
                  color="success"
                  onClick={handleGrant}
                  disabled={isPending || isConfirming || !grantAddress}
                  startIcon={isPending || isConfirming ? <CircularProgress size={20} /> : <PersonAdd />}
                  fullWidth
                >
                  Grant {roleLabel}
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Grid>

      {/* Revoke Role */}
      <Grid item xs={12}>
        <Card sx={{ background: 'rgba(244, 67, 54, 0.1)', border: '1px solid rgba(244, 67, 54, 0.3)' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ color: 'white', display: 'flex', alignItems: 'center', gap: 1 }}>
              <PersonRemove /> Revoke {roleLabel}
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Address"
                  value={revokeAddress}
                  onChange={(e) => setRevokeAddress(e.target.value)}
                  placeholder="0x..."
                  sx={{
                    '& .MuiInputLabel-root': { color: 'rgba(255, 255, 255, 0.7)' },
                    '& .MuiInputBase-input': { color: 'white', fontFamily: 'monospace' },
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.3)' },
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <Button
                  variant="contained"
                  color="error"
                  onClick={handleRevoke}
                  disabled={isPending || isConfirming || !revokeAddress}
                  startIcon={isPending || isConfirming ? <CircularProgress size={20} /> : <PersonRemove />}
                  fullWidth
                >
                  Revoke {roleLabel}
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Grid>

      {/* Success Message */}
      {isSuccess && (
        <Grid item xs={12}>
          <Alert severity="success">
            Role operation completed successfully!
          </Alert>
        </Grid>
      )}
    </Grid>
  );
}

function getRoleDescription(roleType: string): string {
  switch (roleType) {
    case 'POOL_ADMIN':
      return 'Can initialize reserves, update configurations, and manage all pool parameters.';
    case 'EMERGENCY_ADMIN':
      return 'Can pause/unpause reserves in emergency situations. Limited to emergency functions only.';
    case 'RISK_ADMIN':
      return 'Can update risk parameters like collateral factors, supply/borrow caps, and pause reserves.';
    default:
      return '';
  }
}

export default function RolesPanelEnhanced() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <Card sx={{ background: 'rgba(255, 255, 255, 0.05)', backdropFilter: 'blur(10px)' }}>
      <CardContent>
        <Typography variant="h5" gutterBottom sx={{ color: 'white', mb: 3 }}>
          👥 Role Management (Complete)
        </Typography>

        {/* Role Tabs */}
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          sx={{
            mb: 2,
            '& .MuiTab-root': { color: 'rgba(255, 255, 255, 0.6)' },
            '& .Mui-selected': { color: '#4fc3f7 !important' },
            '& .MuiTabs-indicator': { backgroundColor: '#4fc3f7' },
          }}
        >
          <Tab label="POOL_ADMIN" icon={<AdminPanelSettings />} iconPosition="start" />
          <Tab label="EMERGENCY_ADMIN" icon={<Warning />} iconPosition="start" />
          <Tab label="RISK_ADMIN" icon={<Shield />} iconPosition="start" />
        </Tabs>

        {/* Tab Panels */}
        <TabPanel value={activeTab} index={0}>
          <RoleManagementTab 
            roleType="POOL_ADMIN" 
            roleLabel="POOL_ADMIN" 
            roleIcon={<AdminPanelSettings />}
          />
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          <RoleManagementTab 
            roleType="EMERGENCY_ADMIN" 
            roleLabel="EMERGENCY_ADMIN" 
            roleIcon={<Warning />}
          />
        </TabPanel>

        <TabPanel value={activeTab} index={2}>
          <RoleManagementTab 
            roleType="RISK_ADMIN" 
            roleLabel="RISK_ADMIN" 
            roleIcon={<Shield />}
          />
        </TabPanel>

        {/* Warning */}
        <Alert 
          severity="warning"
          sx={{ 
            mt: 3,
            background: 'rgba(255, 152, 0, 0.1)',
            border: '1px solid rgba(255, 152, 0, 0.3)',
          }}
        >
          <Typography variant="body2">
            <strong>⚠️ Warning:</strong> Only grant roles to trusted addresses. Role holders have significant control over the protocol.
          </Typography>
        </Alert>
      </CardContent>
    </Card>
  );
}

