import React, { useCallback, useMemo, useState, useEffect } from 'react';
import Image from 'next/image';
import {
  Box,
  Typography,
  Button,
  Switch,
  Chip,
  Card,
  CardContent,
  CircularProgress,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  useTheme,
} from '@mui/material';
import { Warning } from '@mui/icons-material';
import type { SuppliedBalance } from '../hooks/useSuppliedBalances';
import type { AvailableAsset } from '../hooks/useAvailableReserves';
import { formatUnits } from 'viem';
import { CONTRACTS } from '../config/contracts';
import { useAssetCollateralToggle } from '../hooks/useCollateralToggle';
import { useAccount } from 'wagmi';
import { parseTransactionError } from '../utils/errorHandling';

interface UserSuppliesSectionProps {
  suppliedBalances: Record<string, SuppliedBalance>;
  assets: AvailableAsset[];
  onWithdrawClick: (asset: { address: string; symbol: string; decimals: number; name: string; icon: string; color: string }) => void;
  isLoadingSupplied: boolean;
  isDarkMode: boolean;
  onNavigateToMarkets?: () => void;
  hasActiveBorrowsForSymbol?: (symbol: string) => boolean;
}

const calculateUSDValue = (raw: bigint | null | undefined, decimals: number, price: number | undefined) => {
  if (!raw) return null;
  if (!price || price === 0) return NaN;
  const tokenAmount = Number(formatUnits(raw as bigint, decimals));
  const usd = tokenAmount * price;
  return usd;
};

const formatUSDValue = (value: number | null, isDecrypted: boolean): string => {
  if (!isDecrypted) return '••••••••';
  if (value === null) return '—';
  if (Number.isNaN(value)) return 'Price unavailable';
  if (value < 0.01) return '< $0.01';
  if (value < 1000) return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 2 }).format(value);
};

interface CollateralToggleProps {
  assetAddress: string;
  assetSymbol: string;
  userAddress: string | undefined;
  isDarkMode: boolean;
  hasActiveBorrowsForSymbol?: (symbol: string) => boolean;
  onError?: (error: string) => void;
}

// Collateral Toggle Component - manages the hook and renders toggle UI
const CollateralToggle: React.FC<CollateralToggleProps> = ({
  assetAddress,
  assetSymbol,
  userAddress,
  isDarkMode,
  hasActiveBorrowsForSymbol,
  onError,
}) => {
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  const { isCollateralEnabled, isLoadingStatus, toggleCollateral, isPending, transactionError } = useAssetCollateralToggle({
    assetAddress,
    userAddress,
    enabled: true,
  });

  useEffect(() => {
    if (transactionError && onError) {
      onError(parseTransactionError(transactionError));
    }
  }, [transactionError, onError]);

  const handleToggleCollateral = useCallback(
    async (newValue: boolean) => {
      if (!newValue) {
        const hasBorrows = hasActiveBorrowsForSymbol ? hasActiveBorrowsForSymbol(assetSymbol) : false;
        if (hasBorrows) {
          setConfirmDialogOpen(true);
          return;
        }
      }

      try {
        await toggleCollateral(newValue);
      } catch (err: any) {
        const parsed = parseTransactionError(err);
        if (!parsed.toLowerCase().includes('cancel') && onError) {
          onError(parsed);
        }
      }
    },
    [assetSymbol, toggleCollateral, hasActiveBorrowsForSymbol, onError]
  );

  const confirmDisable = async () => {
    setConfirmDialogOpen(false);
    try {
      await toggleCollateral(false);
    } catch (err: any) {
      const parsed = parseTransactionError(err);
      if (!parsed.toLowerCase().includes('cancel') && onError) {
        onError(parsed);
      }
    }
  };

  const collateralState = isCollateralEnabled || false;

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'center' }}>
        <Switch
          checked={collateralState}
          onChange={() => {
            handleToggleCollateral(!collateralState);
          }}
          inputProps={{ 'aria-label': `Toggle collateral for ${assetSymbol}` }}
          disabled={isLoadingStatus || isPending}
          sx={{
            '& .MuiSwitch-switchBase': {
              color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
              '&.Mui-checked': {
                color: isDarkMode ? '#2196f3' : '#1976d2',
                '& + .MuiSwitch-track': {
                  backgroundColor: isDarkMode ? 'rgba(33, 150, 243, 0.5)' : 'rgba(25, 118, 210, 0.5)',
                },
              },
              '&.Mui-disabled': {
                color: isDarkMode ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)',
                '& + .MuiSwitch-track': {
                  backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                },
              },
            },
            '& .MuiSwitch-track': {
              backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)',
            },
          }}
        />
        {isPending && <CircularProgress size={16} />}
      </Box>

      <Dialog open={confirmDialogOpen} onClose={() => setConfirmDialogOpen(false)}>
        <DialogTitle sx={{ color: isDarkMode ? 'white' : '#000000' }}>Disable Collateral?</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <Warning color="warning" />
            <Typography sx={{ color: isDarkMode ? 'white' : '#000000' }}>
              Disabling this asset as collateral may put your account at risk if you have active borrows. Are you sure you want to continue?
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setConfirmDialogOpen(false)}
            variant="outlined"
            sx={{
              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)',
              color: isDarkMode ? 'white' : '#000000',
              '&:hover': {
                borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)',
                backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
              },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={confirmDisable}
            variant="contained"
            color="warning"
            sx={{
              backgroundColor: isDarkMode ? '#f57c00' : '#f57c00',
              color: 'white',
              '&:hover': {
                backgroundColor: isDarkMode ? '#ef6c00' : '#ef6c00',
              },
            }}
          >
            Disable
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

const UserSuppliesSection: React.FC<UserSuppliesSectionProps> = ({
  suppliedBalances,
  assets,
  onWithdrawClick,
  isLoadingSupplied,
  isDarkMode,
  onNavigateToMarkets,
  hasActiveBorrowsForSymbol,
}) => {
  const theme = useTheme();
  const { address: userAddress } = useAccount();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const positions = useMemo(() => {
    const entries = Object.entries(suppliedBalances || {}).filter(([, v]) => v && (v as SuppliedBalance).hasSupplied);
    const mapped = entries.map(([symbol, bal]) => {
      const asset = assets.find(a => a.symbol === symbol);
      return {
        symbol,
        address: asset?.address || '',
        decimals: asset?.decimals || (bal as any).decimals || 18,
        formattedSupplied: (bal as SuppliedBalance).formattedSupplied,
        rawSupplied: (bal as SuppliedBalance).rawSupplied,
        isDecrypted: (bal as SuppliedBalance).isDecrypted,
        usdValue: asset ? calculateUSDValue((bal as SuppliedBalance).rawSupplied, asset.decimals, asset.price) : null,
        isCollateralEnabled: Boolean(asset?.isCollateral),
        icon: asset?.icon || '/assets/icons/unknown-token.svg',
        color: asset?.color || '#627EEA',
        name: asset?.name || symbol,
      };
    });

    mapped.sort((a, b) => {
      const va = a.usdValue ?? 0;
      const vb = b.usdValue ?? 0;
      if (Number.isNaN(va)) return 1;
      if (Number.isNaN(vb)) return -1;
      return vb - va;
    });
    return mapped;
  }, [suppliedBalances, assets]);

  if (isLoadingSupplied) {
    return (
      <Box>
        {[1, 2, 3].map(i => (
          <SkeletonRow key={i} isDarkMode={isDarkMode} />
        ))}
      </Box>
    );
  }

  if (positions.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 6 }}>
        <Typography variant="h6" sx={{ mb: 1, color: isDarkMode ? 'white' : '#000000' }}>
          Supply assets to get started
        </Typography>
        <Typography variant="body2" sx={{ color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)', mb: 2 }}>
          Supply assets to the protocol to earn interest and use as collateral
        </Typography>
        <Button variant="contained" onClick={() => (onNavigateToMarkets ? onNavigateToMarkets() : undefined)}>
          Go to Markets
        </Button>
      </Box>
    );
  }

  const hasWethPosition = positions.some(p => p.address.toLowerCase() === CONTRACTS.CONFIDENTIAL_WETH.toLowerCase());

  return (
    <Box>
      {errorMessage && (
        <Alert
          severity="error"
          onClose={() => setErrorMessage(null)}
          sx={{
            mb: 2,
            '& .MuiAlert-message': {
              color: isDarkMode ? 'white' : '#000000',
            },
          }}
        >
          {errorMessage}
        </Alert>
      )}

      {/* Desktop table */}
      <Box sx={{ display: { xs: 'none', md: 'block' } }}>
        <Table
          sx={{
            backgroundColor: isDarkMode ? 'transparent' : 'transparent',
            '& .MuiTableHead-root': {
              backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
            },
            '& .MuiTableBody-root .MuiTableRow-root:hover': {
              backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
            },
          }}
        >
          <TableHead>
            <TableRow>
              <TableCell sx={{ color: isDarkMode ? 'white' : '#000000', fontWeight: 'bold' }}>Asset</TableCell>
              <TableCell align="center" sx={{ color: isDarkMode ? 'white' : '#000000', fontWeight: 'bold' }}>
                Balance
              </TableCell>
              <TableCell align="center" sx={{ color: isDarkMode ? 'white' : '#000000', fontWeight: 'bold' }}>
                Value (USD)
              </TableCell>
              <TableCell align="center" sx={{ color: isDarkMode ? 'white' : '#000000', fontWeight: 'bold' }}>
                APY
              </TableCell>
              {hasWethPosition && (
                <TableCell align="center" sx={{ color: isDarkMode ? 'white' : '#000000', fontWeight: 'bold' }}>
                  Collateral
                </TableCell>
              )}
              <TableCell align="center" sx={{ color: isDarkMode ? 'white' : '#000000', fontWeight: 'bold' }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {positions.map(p => (
              <TableRow key={p.symbol} hover>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background: p.color || theme.palette.background.paper,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {p.icon ? (
                        <Image src={p.icon} alt={p.symbol} width={20} height={20} />
                      ) : (
                        <Box />
                      )}
                    </Box>
                    <Box>
                      <Typography sx={{ fontWeight: 700, color: isDarkMode ? 'white' : '#000000' }}>
                        {p.symbol}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}
                      >
                        {p.name}
                      </Typography>
                    </Box>
                  </Box>
                </TableCell>

                <TableCell align="center" sx={{ color: isDarkMode ? 'white' : '#000000' }}>
                  <Box>
                    <Typography sx={{ color: isDarkMode ? 'white' : '#000000' }}>
                      {p.isDecrypted ? p.formattedSupplied : '••••••••'}
                    </Typography>
                  </Box>
                </TableCell>

                <TableCell align="center" sx={{ color: isDarkMode ? 'white' : '#000000' }}>
                  <Tooltip title={p.usdValue === null ? 'Price unavailable' : ''}>
                    <span>{formatUSDValue(p.usdValue === null ? null : p.usdValue, p.isDecrypted)}</span>
                  </Tooltip>
                </TableCell>

                <TableCell align="center" sx={{ color: isDarkMode ? 'white' : '#000000' }}>
                  <Chip
                    label="—"
                    size="small"
                    sx={{
                      color: isDarkMode ? 'white' : '#000000',
                      backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(0, 0, 0, 0.2)',
                    }}
                  />
                </TableCell>

                {hasWethPosition && (
                  <TableCell align="center" sx={{ color: isDarkMode ? 'white' : '#000000' }}>
                    {p.address.toLowerCase() === CONTRACTS.CONFIDENTIAL_WETH.toLowerCase() ? (
                      <CollateralToggle
                        assetAddress={p.address}
                        assetSymbol={p.symbol}
                        userAddress={userAddress}
                        isDarkMode={isDarkMode}
                        hasActiveBorrowsForSymbol={hasActiveBorrowsForSymbol}
                        onError={setErrorMessage}
                      />
                    ) : (
                      <Box />
                    )}
                  </TableCell>
                )}

                <TableCell align="center" sx={{ color: isDarkMode ? 'white' : '#000000' }}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() =>
                      onWithdrawClick({
                        address: p.address,
                        symbol: p.symbol,
                        decimals: p.decimals,
                        name: p.name,
                        icon: p.icon,
                        color: p.color,
                      })
                    }
                    aria-label={`Withdraw ${p.symbol}`}
                    sx={{
                      borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)',
                      color: isDarkMode ? 'white' : '#000000',
                      '&:hover': {
                        borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)',
                        backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                      },
                      '&:disabled': {
                        borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
                        color: isDarkMode ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)',
                      },
                    }}
                  >
                    Withdraw
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>

      {/* Mobile cards */}
      <Box sx={{ display: { xs: 'block', md: 'none' } }}>
        {positions.map(p => (
          <Card
            key={p.symbol}
            sx={{
              mb: 2,
              backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
              border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)',
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background: p.color || theme.palette.background.paper,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {p.icon ? <Image src={p.icon} alt={p.symbol} width={22} height={22} /> : <Box />}
                  </Box>
                  <Box>
                    <Typography sx={{ fontWeight: 700, color: isDarkMode ? 'white' : '#000000' }}>
                      {p.symbol}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}
                    >
                      {p.name}
                    </Typography>
                  </Box>
                </Box>
                {p.isCollateralEnabled && <Chip label="Collateral" color="success" size="small" />}
              </Box>

              <Grid container spacing={1} sx={{ mt: 1 }}>
                <Grid item xs={6}>
                  <Typography
                    variant="caption"
                    sx={{ color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}
                  >
                    Balance
                  </Typography>
                  <Typography sx={{ color: isDarkMode ? 'white' : '#000000' }}>
                    {p.isDecrypted ? p.formattedSupplied : '••••••••'}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography
                    variant="caption"
                    sx={{ color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}
                  >
                    Value
                  </Typography>
                  <Typography sx={{ color: isDarkMode ? 'white' : '#000000' }}>
                    {formatUSDValue(p.usdValue === null ? null : p.usdValue, p.isDecrypted)}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography
                    variant="caption"
                    sx={{ color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}
                  >
                    APY
                  </Typography>
                  <Typography sx={{ color: isDarkMode ? 'white' : '#000000' }}>—</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography
                    variant="caption"
                    sx={{ color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}
                  >
                    Collateral
                  </Typography>
                  {p.address.toLowerCase() === CONTRACTS.CONFIDENTIAL_WETH.toLowerCase() ? (
                    <CollateralToggle
                      assetAddress={p.address}
                      assetSymbol={p.symbol}
                      userAddress={userAddress}
                      isDarkMode={isDarkMode}
                      hasActiveBorrowsForSymbol={hasActiveBorrowsForSymbol}
                      onError={setErrorMessage}
                    />
                  ) : (
                    <Typography sx={{ color: isDarkMode ? 'white' : '#000000' }}>—</Typography>
                  )}
                </Grid>
              </Grid>

              <Box sx={{ mt: 2 }}>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={() =>
                    onWithdrawClick({
                      address: p.address,
                      symbol: p.symbol,
                      decimals: p.decimals,
                      name: p.name,
                      icon: p.icon,
                      color: p.color,
                    })
                  }
                  sx={{
                    borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)',
                    color: isDarkMode ? 'white' : '#000000',
                    '&:hover': {
                      borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)',
                      backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                    },
                  }}
                >
                  Withdraw
                </Button>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>
    </Box>
  );
};

const SkeletonRow: React.FC<{ isDarkMode: boolean }> = ({ isDarkMode }) => (
  <Card
    sx={{
      mb: 2,
      backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
      border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)',
    }}
  >
    <CardContent>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            bgcolor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
          }}
        />
        <Box sx={{ flex: 1 }}>
          <Box
            sx={{
              height: 14,
              width: '40%',
              bgcolor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
              mb: 1,
              borderRadius: '4px',
            }}
          />
          <Box
            sx={{
              height: 12,
              width: '30%',
              bgcolor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
              borderRadius: '4px',
            }}
          />
        </Box>
      </Box>
    </CardContent>
  </Card>
);

export default UserSuppliesSection;
