import React, { useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Skeleton,
  Tooltip,
  Chip,
  LinearProgress,
} from '@mui/material';
import {
  AccountBalanceWallet,
  TrendingUp,
  TrendingDown,
  HealthAndSafety,
} from '@mui/icons-material';
import type { SuppliedBalance } from '../hooks/useSuppliedBalances';
import type { BorrowedBalance } from '../hooks/useBorrowedBalances';
import type { AvailableAsset } from '../hooks/useAvailableReserves';
import { formatUnits } from 'viem';

interface UserOverviewSectionProps {
  suppliedBalances: Record<string, SuppliedBalance>;
  borrowedBalances: Record<string, BorrowedBalance>;
  assets: AvailableAsset[];
  isLoadingSupplied: boolean;
  isLoadingBorrowed: boolean;
  isDarkMode: boolean;
  userCollateralEnabledBySymbol?: Record<string, boolean>;
}

const calculateTotalUSD = (
  balances: Record<string, SuppliedBalance | BorrowedBalance>,
  assets: AvailableAsset[],
  balanceKey: 'rawSupplied' | 'rawBorrowed'
): { isDecrypted: boolean; totalUSD: number } => {
  let totalUSD = 0;
  let isDecrypted = true;

  for (const [symbol, balance] of Object.entries(balances)) {
    if (!balance.isDecrypted) {
      isDecrypted = false;
      continue;
    }

    const asset = assets.find((a) => a.symbol === symbol);
    if (!asset || !balance[balanceKey]) continue;

    const rawValue = balance[balanceKey] as bigint;
    const tokenAmount = Number(formatUnits(rawValue, asset.decimals));
    const usdValue = tokenAmount * asset.price;
    totalUSD += usdValue;
  }

  return { isDecrypted, totalUSD };
};

const calculateHealthFactor = (
  suppliedBalances: Record<string, SuppliedBalance>,
  borrowedBalances: Record<string, BorrowedBalance>,
  assets: AvailableAsset[],
  userCollateralEnabledBySymbol?: Record<string, boolean>
): { isDecrypted: boolean; healthFactor: number } => {
  let totalCollateralValue = 0;
  let totalBorrowedValue = 0;
  let isDecrypted = true;

  for (const [symbol, balance] of Object.entries(suppliedBalances)) {
    if (!balance.isDecrypted) {
      isDecrypted = false;
      continue;
    }

    const asset = assets.find((a) => a.symbol === symbol);
    if (!asset || !balance.rawSupplied) continue;

    // Determine if this asset should be treated as collateral.
    // If userCollateralEnabledBySymbol is undefined, fall back to asset.isCollateral flag.
    const isUserCollateralEnabled = userCollateralEnabledBySymbol
      ? Boolean(userCollateralEnabledBySymbol[symbol])
      : Boolean(asset.isCollateral);

    if (isUserCollateralEnabled) {
      const tokenAmount = Number(formatUnits(balance.rawSupplied, asset.decimals));
      const usdValue = tokenAmount * asset.price;
      totalCollateralValue += usdValue * (asset.ltv / 100);
    }
  }

  for (const [symbol, balance] of Object.entries(borrowedBalances)) {
    if (!balance.isDecrypted) {
      isDecrypted = false;
      continue;
    }

    const asset = assets.find((a) => a.symbol === symbol);
    if (!asset || !balance.rawBorrowed) continue;

    const tokenAmount = Number(formatUnits(balance.rawBorrowed, asset.decimals));
    const usdValue = tokenAmount * asset.price;
    totalBorrowedValue += usdValue;
  }

  if (totalBorrowedValue === 0) return { isDecrypted, healthFactor: Infinity };

  const healthFactor = totalCollateralValue / totalBorrowedValue;
  return { isDecrypted, healthFactor };
};

const formatUSDValue = (value: number, isDecrypted: boolean): string => {
  if (!isDecrypted) return '••••••••';
  if (value < 0.01) return '< $0.01';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    notation: value >= 1000 ? 'compact' : 'standard',
    maximumFractionDigits: 2,
  }).format(value);
};

const UserOverviewSection: React.FC<UserOverviewSectionProps> = ({
  suppliedBalances,
  borrowedBalances,
  assets,
  isLoadingSupplied,
  isLoadingBorrowed,
  isDarkMode,
  userCollateralEnabledBySymbol,
}) => {
  const totalSupplyData = useMemo(
    () => calculateTotalUSD(suppliedBalances, assets, 'rawSupplied'),
    [suppliedBalances, assets]
  );
  const totalBorrowData = useMemo(
    () => calculateTotalUSD(borrowedBalances, assets, 'rawBorrowed'),
    [borrowedBalances, assets]
  );
  const healthFactorData = useMemo(
    () =>
      calculateHealthFactor(
        suppliedBalances,
        borrowedBalances,
        assets,
        userCollateralEnabledBySymbol
      ),
    [suppliedBalances, borrowedBalances, assets, userCollateralEnabledBySymbol]
  );
  const netWorthData = useMemo(() => {
    if (!totalSupplyData.isDecrypted || !totalBorrowData.isDecrypted) {
      return { isDecrypted: false, value: 0 };
    }
    return {
      isDecrypted: true,
      value: totalSupplyData.totalUSD - totalBorrowData.totalUSD,
    };
  }, [totalSupplyData, totalBorrowData]);

  if (isLoadingSupplied || isLoadingBorrowed) {
    return (
      <Grid container spacing={3}>
        {[1, 2, 3, 4].map((i) => (
          <Grid item xs={12} sm={6} md={3} key={i}>
            <Skeleton variant="rectangular" height={120} />
          </Grid>
        ))}
      </Grid>
    );
  }

  // Health factor color helper
  const getHealthColor = (hf: number) => {
    if (hf === Infinity) return 'success';
    if (hf > 2.0) return 'success';
    if (hf >= 1.5) return 'warning';
    return 'error';
  };

  const hfColor = healthFactorData.healthFactor === Infinity ? 'success' : getHealthColor(healthFactorData.healthFactor || 0);

  const cardSx = (dark: boolean) => ({
    background: dark ? 'linear-gradient(135deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))' : 'transparent',
    color: dark ? 'white' : 'inherit',
    border: dark ? '1px solid rgba(255,255,255,0.04)' : '1px solid rgba(0,0,0,0.04)'
  });

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} sm={6} md={3}>
        <Card sx={cardSx(isDarkMode)}>
          <CardContent>
            <Box display="flex" alignItems="center" gap={2}>
              <AccountBalanceWallet fontSize="large" />
              <Typography variant="body2" color="text.secondary">
                Net Worth
              </Typography>
            </Box>
            <Typography variant="h4" fontWeight="bold">
              {formatUSDValue(netWorthData.value, netWorthData.isDecrypted)}
            </Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <Card sx={cardSx(isDarkMode)}>
          <CardContent>
            <Box display="flex" alignItems="center" gap={2}>
              <TrendingUp fontSize="large" color="success" />
              <Typography variant="body2" color="text.secondary">
                Total Supply
              </Typography>
            </Box>
            <Typography variant="h4" fontWeight="bold">
              {formatUSDValue(totalSupplyData.totalUSD, totalSupplyData.isDecrypted)}
            </Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <Card sx={cardSx(isDarkMode)}>
          <CardContent>
            <Box display="flex" alignItems="center" gap={2}>
              <TrendingDown fontSize="large" color="error" />
              <Typography variant="body2" color="text.secondary">
                Total Borrow
              </Typography>
            </Box>
            <Typography variant="h4" fontWeight="bold">
              {formatUSDValue(totalBorrowData.totalUSD, totalBorrowData.isDecrypted)}
            </Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <Card sx={cardSx(isDarkMode)}>
          <CardContent>
            <Box display="flex" alignItems="center" gap={2}>
              <HealthAndSafety fontSize="large" />
              <Typography variant="body2" color="text.secondary">
                Health Factor
              </Typography>
            </Box>
            <Typography variant="h4" fontWeight="bold">
              {healthFactorData.isDecrypted
                ? healthFactorData.healthFactor === Infinity
                  ? '∞'
                  : healthFactorData.healthFactor.toFixed(2)
                : '••••••••'}
            </Typography>

            {/* Visual indicator */}
            {healthFactorData.isDecrypted && (
              <Box sx={{ mt: 1 }}>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(100, (Math.min(healthFactorData.healthFactor === Infinity ? 10 : healthFactorData.healthFactor, 10) / 10) * 100)}
                  color={hfColor as any}
                  sx={{ height: 8, borderRadius: 2 }}
                />
                <Box display="flex" justifyContent="space-between" alignItems="center" mt={0.5}>
                  <Typography variant="caption" color="text.secondary">
                    {healthFactorData.healthFactor === Infinity
                      ? 'Safe'
                      : healthFactorData.healthFactor > 2.0
                      ? 'Safe'
                      : healthFactorData.healthFactor >= 1.5
                      ? 'Moderate'
                      : 'At Risk'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {healthFactorData.healthFactor === Infinity ? '∞' : healthFactorData.healthFactor.toFixed(2)}
                  </Typography>
                </Box>
              </Box>
            )}
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

export default UserOverviewSection;