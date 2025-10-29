'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, useDisconnect } from 'wagmi';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Button,
  Container,
  IconButton,
  Menu,
  MenuItem,
  Chip,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material';
import {
  AdminPanelSettings,
  Logout,
  AccountBalanceWallet,
  ExpandMore,
  ContentCopy,
  CheckCircle,
} from '@mui/icons-material';
import { isAdminWallet } from '@/config/admin/adminConfig';
import { ACL_MANAGER_ABI } from '@/config/admin/adminABI';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const [walletMenuAnchor, setWalletMenuAnchor] = useState<null | HTMLElement>(null);
  const [copied, setCopied] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  // Simple whitelist check (much faster than on-chain verification)
  const isAdmin = isConnected && address ? isAdminWallet(address) : false;

  // Redirect non-admins to home
  useEffect(() => {
    if (isConnected) {
      if (!isAdmin) {
        router.push('/');
      } else {
        setIsChecking(false);
      }
    } else {
      setIsChecking(false);
    }
  }, [isConnected, isAdmin, router]);

  const handleCopyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const keys = Object.keys(localStorage || {});
        for (const k of keys) {
          if (k && k.startsWith('wagmi')) {
            localStorage.removeItem(k);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to clear wagmi localStorage keys on admin disconnect', e);
    }
    setWalletMenuAnchor(null);
    router.push('/');
  };

  // Show loading while checking admin status
  if (isChecking) {
    return (
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      }}>
        <CircularProgress size={60} sx={{ color: '#4fc3f7' }} />
        <Typography sx={{ mt: 3, color: 'white' }}>Verifying admin access...</Typography>
      </Box>
    );
  }

  // Show unauthorized if not admin
  if (!isAdmin || !isConnected) {
    return (
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        p: 3,
      }}>
        <Alert 
          severity="error" 
          icon={<AdminPanelSettings />}
          sx={{ maxWidth: 600 }}
        >
          <Typography variant="h6" gutterBottom>Unauthorized Access</Typography>
          {isConnected ? (
            <>
              <Typography variant="body2" sx={{ mb: 1 }}>
                Connected wallet: <code>{address}</code>
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                This wallet does not have POOL_ADMIN role.
              </Typography>
              <Button 
                variant="contained" 
                color="primary" 
                onClick={() => router.push('/')}
                sx={{ mr: 2 }}
              >
                Go to User Dashboard
              </Button>
              <Button 
                variant="outlined" 
                color="error" 
                onClick={handleDisconnect}
              >
                Disconnect
              </Button>
            </>
          ) : (
            <>
              <Typography variant="body2" sx={{ mb: 2 }}>
                Please connect a wallet with POOL_ADMIN role to access the admin panel.
              </Typography>
              <Button 
                variant="contained" 
                color="primary" 
                onClick={() => router.push('/')}
              >
                Go to User Dashboard
              </Button>
            </>
          )}
        </Alert>
      </Box>
    );
  }

  // Show admin interface
  return (
    <Box sx={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
    }}>
      {/* Admin Header */}
      <AppBar 
        position="static" 
        sx={{ 
          background: 'linear-gradient(135deg, #0f3460 0%, #16213e 100%)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
        }}
      >
        <Toolbar>
          {/* Logo & Title */}
          <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
            <AdminPanelSettings sx={{ fontSize: 40, mr: 2, color: '#4fc3f7' }} />
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, color: 'white' }}>
                Nexora Admin
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                Protocol Management Console
              </Typography>
            </Box>
          </Box>

          {/* Admin Badge */}
          <Chip
            icon={<CheckCircle />}
            label="POOL ADMIN"
            color="success"
            sx={{ mr: 2, fontWeight: 600 }}
          />

          {/* Wallet Info */}
          <Button
            onClick={(e) => setWalletMenuAnchor(e.currentTarget)}
            startIcon={<AccountBalanceWallet />}
            endIcon={<ExpandMore />}
            sx={{
              color: 'white',
              textTransform: 'none',
              background: 'rgba(255, 255, 255, 0.1)',
              '&:hover': {
                background: 'rgba(255, 255, 255, 0.2)',
              },
            }}
          >
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </Button>
        </Toolbar>
      </AppBar>

      {/* Wallet Menu */}
      <Menu
        anchorEl={walletMenuAnchor}
        open={Boolean(walletMenuAnchor)}
        onClose={() => setWalletMenuAnchor(null)}
      >
        <MenuItem disabled>
          <Typography variant="caption" color="text.secondary">
            Connected Wallet
          </Typography>
        </MenuItem>
        <MenuItem onClick={handleCopyAddress}>
          <ContentCopy sx={{ mr: 1, fontSize: 18 }} />
          {copied ? 'Copied!' : `${address?.slice(0, 10)}...${address?.slice(-8)}`}
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleDisconnect}>
          <Logout sx={{ mr: 1, fontSize: 18, color: 'error.main' }} />
          <Typography color="error">Disconnect</Typography>
        </MenuItem>
      </Menu>

      {/* Main Content */}
      <Container maxWidth="xl" sx={{ py: 4 }}>
        {children}
      </Container>
    </Box>
  );
}


