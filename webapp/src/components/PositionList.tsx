'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAccount } from 'wagmi';
import {
  Box,
  Typography,
  Button,
  Chip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Card,
  CardContent,
  Link,
} from '@mui/material';
import { Send, AccountBalance, OpenInNew, Refresh } from '@mui/icons-material';
import { useSuppliedBalances } from '../hooks/useSuppliedBalances';
import { useMasterDecryption } from '../hooks/useMasterDecryption';
import WithdrawForm from './WithdrawForm';
import { TOKEN_METADATA } from '../config/tokenMetadata';

interface SupplyPosition {
  id: string;
  asset: string;
  amount: string;
  apy: string;
  status: string;
  vault: string;
}

interface PositionListProps {
  suppliedBalance?: string;
  hasSupplied?: boolean;
  isDecrypted?: boolean;
  onTransactionSuccess?: () => Promise<void>;
  onNavigateToSupply?: () => void;
  isDarkMode?: boolean;
  masterSignature?: string | null;
  getMasterSignature?: () => any;
}

export default function PositionList({ 
  suppliedBalance: propSuppliedBalance, 
  hasSupplied: propHasSupplied, 
  isDecrypted: propIsDecrypted, 
  onTransactionSuccess, 
  onNavigateToSupply, 
  isDarkMode = false,
  masterSignature: propMasterSignature,
  getMasterSignature: propGetMasterSignature
}: PositionListProps = {}) {
  const { address, isConnected } = useAccount();
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<{ address: string; symbol: string; decimals: number; name: string; icon: string; color: string; } | null>(null);
  const [selectedSuppliedDisplay, setSelectedSuppliedDisplay] = useState<string>('••••••••');
  const hasRenderedOnceRef = useRef(false);

  // Listen for close dialog event
  useEffect(() => {
    const handleCloseDialog = () => {
      setWithdrawDialogOpen(false);
    };
    
    window.addEventListener('closeWithdrawDialog', handleCloseDialog);
    
    return () => {
      window.removeEventListener('closeWithdrawDialog', handleCloseDialog);
    };
  }, []);
  
  // Use props if provided, otherwise create own instance (for backwards compatibility)
  const { masterSignature: ownMasterSignature, getMasterSignature: ownGetMasterSignature } = useMasterDecryption();
  const masterSignature = propMasterSignature !== undefined ? propMasterSignature : ownMasterSignature;
  const getMasterSignature = propGetMasterSignature || ownGetMasterSignature;

  // Multi-asset supplied balances
  const {
    balances,
    isLoading: balancesLoading,
    decryptAllBalances,
    refetch,
  } = useSuppliedBalances(masterSignature, getMasterSignature);

  // Compute positions from balances (stable, no intermediate clears)
  const positions = useMemo<SupplyPosition[]>(() => {
    const list: SupplyPosition[] = [];
    Object.values(balances).forEach((b) => {
      if (!b) return;
      if (b.hasSupplied) {
        list.push({
          id: `${b.symbol}-supply`,
          asset: b.symbol,
          amount: b.formattedSupplied,
          apy: '5.00%',
          status: 'Active',
          vault: 'POOL',
        });
      }
    });
    return list;
  }, [balances]);

  useEffect(() => {
    if (positions.length > 0) {
      hasRenderedOnceRef.current = true;
    }
  }, [positions.length]);

  if (!isConnected) {
    return (
      <Alert severity="info">
        Please connect your wallet to view your positions.
      </Alert>
    );
  }

  // Check if any balances are currently being decrypted
  const isDecrypting = Object.values(balances).some(b => b?.isLoading);

  if (balancesLoading && !hasRenderedOnceRef.current) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
        <Typography>Loading positions...</Typography>
      </Box>
    );
  }

  if (isDecrypting && !hasRenderedOnceRef.current) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
        <Typography>Verifying position balance...</Typography>
      </Box>
    );
  }

  if (positions.length === 0) {
    return (
      <Box sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 6,
        px: 3,
        textAlign: 'center'
      }}>
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography
            variant="h6"
            sx={{
              fontFamily: '"SF Pro Text", "Inter", sans-serif',
              fontWeight: '500',
              fontSize: '1.1rem',
              color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(44, 62, 80, 0.7)',
              letterSpacing: '-0.025em'
            }}
          >
            No active positions
          </Typography>
        </Box>
        <Button
          variant="contained"
          size="small"
          onClick={onNavigateToSupply}
          sx={{
            fontFamily: '"SF Pro Text", "Inter", sans-serif',
            fontWeight: '500',
            fontSize: '0.8rem',
            textTransform: 'none',
            letterSpacing: '0.025em',
            px: 3,
            py: 1,
            borderRadius: '6px',
            background: isDarkMode ? '#3b82f6' : '#2563eb',
            color: 'white',
            transition: 'all 0.2s ease',
            '&:hover': {
              background: isDarkMode ? '#2563eb' : '#1d4ed8',
              transform: 'translateY(-1px)'
            }
          }}
        >
          Start Supplying
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', overflow: 'hidden' }}>
      {/* Desktop Table View - Hidden on small screens */}
      <Box sx={{
        display: { xs: 'none', md: 'block' },
        width: '100%',
        overflowX: 'auto',
        m: 0,
        p: 0,
        '& table': {
          width: '100%',
          minWidth: '100%',
          borderCollapse: 'collapse',
          border: isDarkMode
            ? '1px solid rgba(255, 255, 255, 0.1)'
            : '1px solid rgba(44, 62, 80, 0.1)',
          borderRadius: '0px',
          overflow: 'hidden',
          margin: 0
        },
        '& th, & td': {
          padding: '12px 16px',
          textAlign: 'left',
          borderBottom: isDarkMode
            ? '1px solid rgba(255, 255, 255, 0.1)'
            : '1px solid rgba(44, 62, 80, 0.1)'
        },
        '& th': {
          background: isDarkMode
            ? 'rgba(255, 255, 255, 0.08)'
            : 'rgba(44, 62, 80, 0.08)',
          fontWeight: '600',
          fontSize: '0.875rem',
          color: isDarkMode ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)'
        },
        '& tbody tr:hover': {
          background: isDarkMode
            ? 'rgba(255, 255, 255, 0.05)'
            : 'rgba(44, 62, 80, 0.05)'
        }
      }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: '200px' }}>Asset</th>
              <th style={{ width: '150px', textAlign: 'center' }}>Supplied Amount</th>
              <th style={{ width: '100px', textAlign: 'center' }}>APY</th>
              <th style={{ width: '100px', textAlign: 'center' }}>Status</th>
              <th style={{ width: '120px', textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((position) => {
              const entry = Object.values(balances).find(b => b && b.symbol === position.asset);
              const isDecrypted = entry?.isDecrypted || false;

              return (
                <tr key={position.id}>
                  {/* Asset column */}
                  <td>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Box sx={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(44, 62, 80, 0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        {(() => {
                          const meta = Object.values(TOKEN_METADATA).find(m => m.symbol === position.asset);
                          const icon = meta?.icon || '/assets/icons/ethereum.svg';
                          const alt = meta?.name || position.asset;
                          return <img src={icon} alt={alt} style={{ width: 20, height: 20 }} />;
                        })()}
                      </Box>
                      <Box>
                        <Typography variant="body1" sx={{ fontWeight: 600 }}>
                          {position.asset}
                        </Typography>
                        <Typography variant="caption" sx={{ opacity: 0.7 }}>
                          {(() => {
                            const meta = Object.values(TOKEN_METADATA).find(m => m.symbol === position.asset);
                            return meta?.name || position.asset;
                          })()}
                        </Typography>
                      </Box>
                    </Box>
                  </td>

                  {/* Supplied Amount */}
                  <td style={{ textAlign: 'center' }}>
                    <Typography variant="body2" sx={{ opacity: 0.8 }}>
                      {entry?.formattedSupplied || position.amount}
                    </Typography>
                    <Typography variant="caption" sx={{
                      opacity: 0.6,
                      display: 'block',
                      mt: 0.5,
                      fontSize: '0.7rem'
                    }}>
                      {isDecrypted ? 'Decrypted' : 'Encrypted'}
                    </Typography>
                  </td>

                  {/* APY */}
                  <td style={{ textAlign: 'center' }}>
                    <Chip
                      label={position.apy}
                      size="small"
                      sx={{
                        background: isDarkMode
                          ? 'rgba(76, 175, 80, 0.2)'
                          : 'rgba(76, 175, 80, 0.1)',
                        color: isDarkMode ? '#4caf50' : '#2e7d32',
                        border: isDarkMode
                          ? '1px solid rgba(76, 175, 80, 0.3)'
                          : '1px solid rgba(76, 175, 80, 0.2)',
                        fontWeight: '600'
                      }}
                    />
                  </td>

                  {/* Status */}
                  <td style={{ textAlign: 'center' }}>
                    <Chip
                      label={position.status}
                      size="small"
                      sx={{
                        background: isDarkMode
                          ? 'rgba(33, 150, 243, 0.2)'
                          : 'rgba(33, 150, 243, 0.1)',
                        color: isDarkMode ? '#2196f3' : '#1976d2',
                        border: isDarkMode
                          ? '1px solid rgba(33, 150, 243, 0.3)'
                          : '1px solid rgba(33, 150, 243, 0.2)',
                        fontWeight: '600'
                      }}
                    />
                  </td>

                  {/* Action */}
                  <td style={{ textAlign: 'center' }}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<Send />}
                      onClick={() => {
                        // Set selected asset for withdraw dialog
                        const meta = Object.values(TOKEN_METADATA).find(m => m.symbol === position.asset);
                        const decimals = meta?.decimals ?? 18;
                        const icon = meta?.icon ?? '/assets/icons/ethereum.svg';
                        const color = meta?.color ?? '#627EEA';
                        const addressBySymbol = Object.entries(TOKEN_METADATA).find(([addr, m]) => m.symbol === position.asset)?.[0] as string | undefined;
                        if (addressBySymbol) {
                          setSelectedAsset({
                            address: addressBySymbol,
                            symbol: position.asset,
                            decimals,
                            name: meta?.name || position.asset,
                            icon,
                            color
                          });
                          const display = entry?.formattedSupplied || position.amount;
                          setSelectedSuppliedDisplay(display);
                          setWithdrawDialogOpen(true);
                        }
                      }}
                      disabled={isDecrypting}
                      sx={{
                        color: isDarkMode ? 'white' : '#2c3e50',
                        borderColor: isDarkMode
                          ? 'rgba(255, 255, 255, 0.3)'
                          : 'rgba(44, 62, 80, 0.4)',
                        borderRadius: '4px',
                        textTransform: 'none',
                        fontWeight: '600',
                        px: 2,
                        py: 1,
                        '&:hover': {
                          borderColor: isDarkMode
                            ? 'rgba(255, 255, 255, 0.5)'
                            : 'rgba(44, 62, 80, 0.6)',
                          backgroundColor: isDarkMode
                            ? 'rgba(255, 255, 255, 0.05)'
                            : 'rgba(44, 62, 80, 0.05)',
                          transform: 'translateY(-1px)'
                        },
                        '&:disabled': {
                          opacity: 0.6,
                          cursor: 'not-allowed'
                        },
                        transition: 'all 0.3s ease'
                      }}
                    >
                      Withdraw
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Box>

      {/* Mobile Card View - Hidden on medium screens and up */}
      <Box sx={{
        display: { xs: 'flex', sm: 'flex', md: 'none' },
        flexDirection: 'column',
        gap: 2
      }}>
        {positions.map((position) => {
          const entry = Object.values(balances).find(b => b && b.symbol === position.asset);
          const isDecrypted = entry?.isDecrypted || false;

          return (
            <Card
              key={`mobile-${position.id}`}
              sx={{
                borderRadius: '0px',
                background: isDarkMode
                  ? 'rgba(255, 255, 255, 0.05)'
                  : 'rgba(255, 255, 255, 0.8)',
                border: isDarkMode
                  ? '1px solid rgba(255, 255, 255, 0.1)'
                  : '1px solid rgba(44, 62, 80, 0.1)',
                boxShadow: isDarkMode
                  ? '0 4px 12px rgba(0, 0, 0, 0.2)'
                  : '0 4px 12px rgba(0, 0, 0, 0.08)'
              }}
            >
              <CardContent sx={{ p: 2 }}>
                {/* Asset Header */}
                <Box sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  mb: 2,
                  pb: 2,
                  borderBottom: isDarkMode
                    ? '1px solid rgba(255, 255, 255, 0.1)'
                    : '1px solid rgba(44, 62, 80, 0.1)'
                }}>
                  <Box sx={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(44, 62, 80, 0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    {(() => {
                      const meta = Object.values(TOKEN_METADATA).find(m => m.symbol === position.asset);
                      const icon = meta?.icon || '/assets/icons/ethereum.svg';
                      const alt = meta?.name || position.asset;
                      return <img src={icon} alt={alt} style={{ width: 18, height: 18 }} />;
                    })()}
                  </Box>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem' }}>
                      {position.asset}
                    </Typography>
                    <Typography variant="caption" sx={{ opacity: 0.7, fontSize: '0.75rem' }}>
                      {(() => {
                        const meta = Object.values(TOKEN_METADATA).find(m => m.symbol === position.asset);
                        return meta?.name || position.asset;
                      })()}
                    </Typography>
                  </Box>
                </Box>

                {/* Position Data Grid - Improved Layout */}
                <Box sx={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 1.5,
                  mb: 2,
                  px: 1
                }}>
                  <Box sx={{
                    textAlign: 'center',
                    p: 1,
                    minHeight: '60px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center'
                  }}>
                    <Typography variant="caption" sx={{
                      opacity: 0.7,
                      fontSize: '0.65rem',
                      color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(44, 62, 80, 0.7)',
                      mb: 0.5
                    }}>
                      Supplied Amount
                    </Typography>
                    <Typography variant="body2" sx={{
                      fontWeight: 600,
                      fontSize: '0.8rem'
                    }}>
                      {entry?.formattedSupplied || position.amount}
                    </Typography>
                  </Box>

                  <Box sx={{
                    textAlign: 'center',
                    p: 1,
                    minHeight: '60px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center'
                  }}>
                    <Typography variant="caption" sx={{
                      opacity: 0.7,
                      fontSize: '0.65rem',
                      color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(44, 62, 80, 0.7)',
                      mb: 0.5
                    }}>
                      APY
                    </Typography>
                    <Typography variant="body2" sx={{
                      fontWeight: '600',
                      fontSize: '0.8rem',
                      color: isDarkMode ? '#4caf50' : '#2e7d32'
                    }}>
                      {position.apy}
                    </Typography>
                  </Box>

                  <Box sx={{
                    textAlign: 'center',
                    p: 1,
                    minHeight: '60px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center'
                  }}>
                    <Typography variant="caption" sx={{
                      opacity: 0.7,
                      fontSize: '0.65rem',
                      color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(44, 62, 80, 0.7)',
                      mb: 0.5
                    }}>
                      Status
                    </Typography>
                    <Typography variant="body2" sx={{
                      fontWeight: '600',
                      fontSize: '0.8rem',
                      color: isDarkMode ? '#2196f3' : '#1976d2'
                    }}>
                      {position.status}
                    </Typography>
                  </Box>

                  <Box sx={{
                    textAlign: 'center',
                    p: 1,
                    minHeight: '60px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center'
                  }}>
                    <Typography variant="caption" sx={{
                      opacity: 0.7,
                      fontSize: '0.65rem',
                      color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(44, 62, 80, 0.7)',
                      mb: 1
                    }}>
                      Action
                    </Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        // Set selected asset for withdraw dialog
                        const meta = Object.values(TOKEN_METADATA).find(m => m.symbol === position.asset);
                        const decimals = meta?.decimals ?? 18;
                        const icon = meta?.icon ?? '/assets/icons/ethereum.svg';
                        const color = meta?.color ?? '#627EEA';
                        const addressBySymbol = Object.entries(TOKEN_METADATA).find(([addr, m]) => m.symbol === position.asset)?.[0] as string | undefined;
                        if (addressBySymbol) {
                          setSelectedAsset({
                            address: addressBySymbol,
                            symbol: position.asset,
                            decimals,
                            name: meta?.name || position.asset,
                            icon,
                            color
                          });
                          const display = entry?.formattedSupplied || position.amount;
                          setSelectedSuppliedDisplay(display);
                          setWithdrawDialogOpen(true);
                        }
                      }}
                      disabled={isDecrypting}
                      sx={{
                        color: isDarkMode ? 'white' : '#2c3e50',
                        borderColor: isDarkMode
                          ? 'rgba(255, 255, 255, 0.3)'
                          : 'rgba(44, 62, 80, 0.4)',
                        borderRadius: '0px',
                        textTransform: 'none',
                        fontWeight: '600',
                        fontSize: '0.65rem',
                        px: 1,
                        py: 0.4,
                        minHeight: '24px',
                        maxHeight: '24px',
                        width: 'auto',
                        minWidth: '60px',
                        maxWidth: '70px',
                        '&:hover': {
                          borderColor: isDarkMode
                            ? 'rgba(255, 255, 255, 0.5)'
                            : 'rgba(44, 62, 80, 0.6)',
                          backgroundColor: isDarkMode
                            ? 'rgba(255, 255, 255, 0.05)'
                            : 'rgba(44, 62, 80, 0.05)',
                          transform: 'translateY(-1px)'
                        },
                        '&:disabled': {
                          opacity: 0.6,
                          cursor: 'not-allowed'
                        },
                        transition: 'all 0.3s ease'
                      }}
                    >
                      Withdraw
                    </Button>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          );
        })}
      </Box>

      {/* Withdraw Dialog */}
      <Dialog 
        open={withdrawDialogOpen} 
        onClose={() => setWithdrawDialogOpen(false)}
        maxWidth={false}
        PaperProps={{
          sx: {
            maxWidth: '380px',
            width: 'auto',
            borderRadius: '4px'
          }
        }}
      >
        <DialogContent sx={{ p: 0 }}>
          <WithdrawForm 
            onTransactionSuccess={onTransactionSuccess}
            suppliedBalance={selectedSuppliedDisplay}
            hasSupplied={true}
            isDecrypted={!selectedSuppliedDisplay.includes('•')}
            selectedAsset={selectedAsset || undefined}
          />
        </DialogContent>
      </Dialog>
    </Box>
  );
}
