import React from 'react';
import {
  Box,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Button,
  Typography,
  Chip,
  LinearProgress,
  Card,
  CardContent,
  Grid,
  Tooltip,
  CircularProgress,
  Skeleton
} from '@mui/material';
import Image from 'next/image';
import { CheckCircle, Lock, LockOpen } from '@mui/icons-material';
import type { AvailableAsset } from '../hooks/useAvailableReserves';
import type { ReserveTotals } from '../hooks/useReserveTotals';
import type { SuppliedBalance } from '../hooks/useSuppliedBalances';
import type { BorrowedBalance } from '../hooks/useBorrowedBalances';
import { formatUnits } from 'viem';
import { calculateUtilizationRate } from '../utils/calculations';
import UtilizationRateBar from './UtilizationRateBar';
import { useAssetCollateralToggle } from '../hooks/useCollateralToggle';
import { CONTRACTS } from '../config/contracts';

export interface MarketsTabProps {
  assets: AvailableAsset[];
  reserveTotals: Record<string, ReserveTotals>;
  suppliedBalances: Record<string, SuppliedBalance>;
  borrowedBalances: Record<string, BorrowedBalance>;
  onSupplyClick: (asset: AvailableAsset) => void;
  onBorrowClick: (asset: AvailableAsset) => void;
  onDecryptTotals: () => void;
  isDarkMode: boolean;
  isLoadingReserves: boolean;
  isDecryptingTotals: boolean;
  // map from asset symbol to whether the user has enabled collateral for that asset
  userCollateralEnabledBySymbol?: Record<string, boolean>;
  userAddress?: string;
}

const formatTokenAmount = (raw: bigint | null, decimals = 18, symbol = ''): string => {
  if (raw === null) return `0 ${symbol}`;
  try {
    const asStr = formatUnits(raw, decimals);
    const num = parseFloat(asStr);

    if (isNaN(num)) return `0 ${symbol}`;

    // Very small values: show up to 8 decimals
    if (Math.abs(num) > 0 && Math.abs(num) < 1) {
      return `${num.toFixed(8)} ${symbol}`;
    }

    // Small-to-medium values: show fixed decimals
    if (Math.abs(num) >= 1 && Math.abs(num) < 1000) {
      return `${num.toFixed(6)} ${symbol}`;
    }

    // Large values: use compact notation with significant digits
    const nf = new Intl.NumberFormat(undefined, { notation: 'compact', maximumSignificantDigits: 4 });
    return `${nf.format(num)} ${symbol}`;
  } catch (e) {
    return `0 ${symbol}`;
  }
};

// Utilization calculation and UI extracted to reusable utilities/components

export default function MarketsTab({
  assets,
  reserveTotals,
  suppliedBalances,
  borrowedBalances,
  onSupplyClick,
  onBorrowClick,
  onDecryptTotals,
  isDarkMode,
  isLoadingReserves,
  isDecryptingTotals,
  userCollateralEnabledBySymbol,
  userAddress
}: MarketsTabProps) {
  // Check collateral status for cWETH specifically - must be called before any early returns
  const { isCollateralEnabled: isCWEthCollateralEnabled, isLoadingStatus: isLoadingCWEthCollateral } = useAssetCollateralToggle({
    assetAddress: CONTRACTS.CONFIDENTIAL_WETH,
    userAddress,
    enabled: true,
  });

  if (isLoadingReserves) {
    return (
      <Box display="flex" flexDirection="column" gap={2}>
        {[1,2,3,4].map(i => (
          <Skeleton key={i} variant="rectangular" height={64} />
        ))}
      </Box>
    );
  }

  if (!assets || assets.length === 0) {
    return (
      <Box textAlign="center" py={6}>
        <Typography variant="h6" sx={{ color: isDarkMode ? 'white' : '#000000' }}>No markets available. Check back soon!</Typography>
      </Box>
    );
  }

  const anyEncrypted = Object.values(reserveTotals || {}).some(r => r && !r.isDecrypted);
  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6" sx={{ color: isDarkMode ? 'white' : '#000000' }}>Markets</Typography>
        <Box>
          {anyEncrypted && (
            <Button onClick={onDecryptTotals} variant="outlined" size="small" startIcon={isDecryptingTotals ? <CircularProgress size={16} /> : undefined} sx={{
              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)',
              color: isDarkMode ? 'white' : '#000000',
              '&:hover': {
                borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)',
                backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
              }
            }}>
              {isDecryptingTotals ? 'Decrypting...' : 'Decrypt Totals'}
            </Button>
          )}
        </Box>
      </Box>

      <Box sx={{ display: { xs: 'none', md: 'block' } }}>
        <Table sx={{
          backgroundColor: isDarkMode ? 'transparent' : 'transparent',
          '& .MuiTableHead-root': {
            backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
          },
          '& .MuiTableBody-root .MuiTableRow-root:hover': {
            backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
          }
        }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ color: isDarkMode ? 'white' : '#000000', fontWeight: 'bold' }}>Asset</TableCell>
              <TableCell sx={{ color: isDarkMode ? 'white' : '#000000', fontWeight: 'bold' }}>Total Supplied</TableCell>
              <TableCell sx={{ color: isDarkMode ? 'white' : '#000000', fontWeight: 'bold' }}>Supply APY</TableCell>
              <TableCell sx={{ color: isDarkMode ? 'white' : '#000000', fontWeight: 'bold' }}>Total Borrowed</TableCell>
              <TableCell sx={{ color: isDarkMode ? 'white' : '#000000', fontWeight: 'bold' }}>Borrow APY</TableCell>
              <TableCell sx={{ color: isDarkMode ? 'white' : '#000000', fontWeight: 'bold' }}>Available Liquidity</TableCell>
              <TableCell sx={{ color: isDarkMode ? 'white' : '#000000', fontWeight: 'bold' }}>Utilization</TableCell>
              <TableCell sx={{ color: isDarkMode ? 'white' : '#000000', fontWeight: 'bold' }}></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {assets.map(asset => {
              const totals = reserveTotals?.[asset.symbol];
              const isDecrypted = totals?.isDecrypted;
              const totalSuppliedRaw = totals?.rawTotalSupplied ?? null;
              const totalBorrowedRaw = totals?.rawTotalBorrowed ?? null;
              const suppliedVal = isDecrypted ? formatTokenAmount(totalSuppliedRaw, asset.decimals, asset.symbol) : '••••••••';
              const borrowedVal = isDecrypted ? formatTokenAmount(totalBorrowedRaw, asset.decimals, asset.symbol) : '••••••••';
              let availableLiquidityRaw: bigint | null = null;
              if (isDecrypted && totalSuppliedRaw !== null && totalBorrowedRaw !== null) {
                const diff = totalSuppliedRaw - totalBorrowedRaw;
                availableLiquidityRaw = diff < BigInt(0) ? BigInt(0) : diff;
              }
              const availableLiquidity = availableLiquidityRaw !== null ? formatTokenAmount(availableLiquidityRaw, asset.decimals, asset.symbol) : '••••••••';

              // utilization using centralized util
              const utilization = isDecrypted ? calculateUtilizationRate(totalBorrowedRaw, totalSuppliedRaw) : 0;

              const suppliedPosition = suppliedBalances?.[asset.symbol];
              const borrowedPosition = borrowedBalances?.[asset.symbol];

              return (
                <TableRow key={asset.symbol} hover>
                  <TableCell sx={{ color: isDarkMode ? 'white' : '#000000' }}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Box sx={{ position: 'relative', width: 32, height: 32 }}>
                        <Image src={asset.icon || '/assets/icons/placeholder.svg'} alt={asset.symbol} width={32} height={32} style={{ borderRadius: '50%' }} />
                      </Box>
                      <Box>
                        <Typography variant="body2" sx={{ color: isDarkMode ? 'white' : '#000000' }}>{asset.name}</Typography>
                        <Typography variant="caption" sx={{ color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>{asset.symbol}</Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ color: isDarkMode ? 'white' : '#000000' }}>{suppliedVal}</TableCell>
                  <TableCell sx={{ color: isDarkMode ? 'white' : '#000000' }}>—</TableCell>
                  <TableCell sx={{ color: isDarkMode ? 'white' : '#000000' }}>{borrowedVal}</TableCell>
                  <TableCell sx={{ color: isDarkMode ? 'white' : '#000000' }}>—</TableCell>
                  <TableCell sx={{ color: isDarkMode ? 'white' : '#000000' }}>
                    <Tooltip title={isDecrypted ? `${availableLiquidity}` : 'Decrypt totals to see available liquidity'}>
                      <span>{availableLiquidity}</span>
                    </Tooltip>
                  </TableCell>
                  <TableCell sx={{ color: isDarkMode ? 'white' : '#000000' }}>
                    <UtilizationRateBar utilization={utilization} size="large" decimals={1} isDarkMode={isDarkMode} />
                  </TableCell>
                  <TableCell sx={{ color: isDarkMode ? 'white' : '#000000' }}>
                      <Box display="flex" gap={1}>
                      <Button size="small" variant="contained" onClick={() => onSupplyClick(asset)}>Supply</Button>
                      {(() => {
                        const hasCollateral = isCWEthCollateralEnabled ?? false;
                        const isChecking = isLoadingCWEthCollateral;
                        const canBorrow = asset.borrowingEnabled && hasCollateral;

                        if (!asset.borrowingEnabled) {
                          return (
                            <Tooltip title="Borrowing disabled for this asset"><span><Button size="small" variant="outlined" disabled sx={{
                              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.8)',
                              color: isDarkMode ? 'rgba(255, 255, 255, 0.9)' : '#000000',
                              backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)',
                              opacity: 0.9,
                            }}>Borrow</Button></span></Tooltip>
                          );
                        }

                        if (isChecking) {
                          return (
                            // TODO: Update to generic message when supporting multiple collateral assets
                            <Tooltip title="Checking cWETH collateral status...">
                              <span>
                                <Button size="small" variant="outlined" disabled startIcon={<CircularProgress size={14} />} sx={{
                                  borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.8)',
                                  color: isDarkMode ? 'rgba(255, 255, 255, 0.9)' : '#000000',
                                  backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)',
                                  opacity: 0.9,
                                }}>
                                  Borrow
                                </Button>
                              </span>
                            </Tooltip>
                          );
                        }

                        if (!canBorrow) {
                          return (
                            // TODO: Update to generic message when supporting multiple collateral assets
                            <Tooltip title="Enable cWETH as collateral first"><span><Button size="small" variant="outlined" disabled sx={{
                              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.8)',
                              color: isDarkMode ? 'rgba(255, 255, 255, 0.9)' : '#000000',
                              backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)',
                              opacity: 0.9,
                            }}>Borrow</Button></span></Tooltip>
                          );
                        }

                        return <Button size="small" variant="outlined" onClick={() => onBorrowClick(asset)} sx={{
                          borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)',
                          color: isDarkMode ? 'white' : '#000000',
                          '&:hover': {
                            borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)',
                            backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                          }
                        }}>Borrow</Button>;
                      })()}
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Box>

      {/* Mobile cards */}
      <Box sx={{ display: { xs: 'block', md: 'none' } }}>
        <Grid container spacing={2}>
          {assets.map(asset => {
            const totals = reserveTotals?.[asset.symbol];
            const isDecrypted = totals?.isDecrypted;
            const totalSuppliedRaw = totals?.rawTotalSupplied ?? null;
            const totalBorrowedRaw = totals?.rawTotalBorrowed ?? null;
            // Clamp available liquidity at zero
            let availableLiquidityRaw: bigint | null = null;
            if (isDecrypted && totalSuppliedRaw !== null && totalBorrowedRaw !== null) {
              const diff = totalSuppliedRaw - totalBorrowedRaw;
              availableLiquidityRaw = diff < BigInt(0) ? BigInt(0) : diff;
            }
            const availableLiquidity = availableLiquidityRaw !== null ? formatTokenAmount(availableLiquidityRaw, asset.decimals, asset.symbol) : '••••••••';

            // utilization using centralized util
            const utilization = isDecrypted ? calculateUtilizationRate(totalBorrowedRaw, totalSuppliedRaw) : 0;

            const suppliedPosition = suppliedBalances?.[asset.symbol];
            const borrowedPosition = borrowedBalances?.[asset.symbol];

            return (
              <Grid item xs={12} key={asset.symbol}>
                <Card sx={{
                  backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                  border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)'
                }}>
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Box display="flex" gap={1} alignItems="center">
                        <Box sx={{ position: 'relative', width: 32, height: 32 }}>
                          <Image src={asset.icon || '/assets/icons/placeholder.svg'} alt={asset.symbol} width={32} height={32} style={{ borderRadius: '50%' }} />
                        </Box>
                        <Box>
                          <Typography variant="body1" sx={{ color: isDarkMode ? 'white' : '#000000' }}>{asset.name}</Typography>
                          <Typography variant="caption" sx={{ color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>{asset.symbol}</Typography>
                        </Box>
                      </Box>
                      {/* Show user-level collateral enabled chip if provided; fall back to reserve-level flag if not available */}
                      {(userCollateralEnabledBySymbol ? userCollateralEnabledBySymbol[asset.symbol] : asset.isCollateral) ? <Chip size="small" icon={<CheckCircle />} label="Collateral" /> : null}
                    </Box>

                    <Grid container spacing={1} mt={1}>
                      <Grid item xs={6}>
                        <Typography variant="caption" sx={{ color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>Supply APY</Typography>
                        <Tooltip title="APY coming soon"><Typography variant="body2" sx={{ color: isDarkMode ? 'white' : '#000000' }}>—</Typography></Tooltip>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="caption" sx={{ color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>Borrow APY</Typography>
                        <Tooltip title="APY coming soon"><Typography variant="body2" sx={{ color: isDarkMode ? 'white' : '#000000' }}>—</Typography></Tooltip>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="caption" sx={{ color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>Available</Typography>
                        <Typography variant="body2" sx={{ color: isDarkMode ? 'white' : '#000000' }}>{availableLiquidity}</Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="caption" sx={{ color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>Utilization</Typography>
                        <Box display="flex" alignItems="center" gap={1}>
                              <UtilizationRateBar utilization={utilization} size="medium" decimals={0} isDarkMode={isDarkMode} />
                        </Box>
                      </Grid>
                    </Grid>


                    <Box mt={2} display="flex" gap={1}>
                      <Button fullWidth size="small" variant="contained" onClick={() => onSupplyClick(asset)}>Supply</Button>
                      {(() => {
                        const hasCollateral = isCWEthCollateralEnabled ?? false;
                        const isChecking = isLoadingCWEthCollateral;
                        const canBorrow = asset.borrowingEnabled && hasCollateral;

                        if (!asset.borrowingEnabled) {
                          return (
                            <Tooltip title="Borrowing disabled for this asset"><span><Button fullWidth size="small" variant="outlined" disabled sx={{
                              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.8)',
                              color: isDarkMode ? 'rgba(255, 255, 255, 0.9)' : '#000000',
                              backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)',
                              opacity: 0.9,
                            }}>Borrow</Button></span></Tooltip>
                          );
                        }

                        if (isChecking) {
                          return (
                            // TODO: Update to generic message when supporting multiple collateral assets
                            <Tooltip title="Checking cWETH collateral status...">
                              <span>
                                <Button fullWidth size="small" variant="outlined" disabled startIcon={<CircularProgress size={14} />} sx={{
                                  borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.8)',
                                  color: isDarkMode ? 'rgba(255, 255, 255, 0.9)' : '#000000',
                                  backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)',
                                  opacity: 0.9,
                                }}>
                                  Borrow
                                </Button>
                              </span>
                            </Tooltip>
                          );
                        }

                        if (!canBorrow) {
                          return (
                            // TODO: Update to generic message when supporting multiple collateral assets
                            <Tooltip title="Enable cWETH as collateral first"><span><Button fullWidth size="small" variant="outlined" disabled sx={{
                              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.8)',
                              color: isDarkMode ? 'rgba(255, 255, 255, 0.9)' : '#000000',
                              backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)',
                              opacity: 0.9,
                            }}>Borrow</Button></span></Tooltip>
                          );
                        }

                        return <Button fullWidth size="small" variant="outlined" onClick={() => onBorrowClick(asset)} sx={{
                          borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)',
                          color: isDarkMode ? 'white' : '#000000',
                          '&:hover': {
                            borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)',
                            backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                          }
                        }}>Borrow</Button>;
                      })()}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </Box>
    </Box>
  );
}
