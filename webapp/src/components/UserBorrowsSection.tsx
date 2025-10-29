import React, { useMemo } from 'react';
import Image from 'next/image';
import {
  Box,
  Typography,
  Button,
  Chip,
  Card,
  CardContent,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  useTheme,
  Tooltip,
} from '@mui/material';
import { Send } from '@mui/icons-material';
import type { BorrowedBalance } from '../hooks/useBorrowedBalances';
import type { SuppliedBalance } from '../hooks/useSuppliedBalances';
import type { AvailableAsset } from '../hooks/useAvailableReserves';
import { formatUnits } from 'viem';

interface UserBorrowsSectionProps {
  borrowedBalances: Record<string, BorrowedBalance>;
  suppliedBalances: Record<string, SuppliedBalance>;
  assets: AvailableAsset[];
  userCollateralEnabled: Record<string, boolean> | undefined;
  onRepayClick: (asset: { address: string; symbol: string; decimals: number; name: string; icon: string; color: string; price?: number }) => void;
  isLoadingBorrowed: boolean;
  isDarkMode: boolean;
  onNavigateToMarkets?: () => void;
}

const calculateUSDValue = (raw: bigint | null | undefined, decimals: number, price: number | undefined) => {
  if (raw === null || raw === undefined) return null;
  if (!price || price === 0) return NaN;
  const tokenAmount = Number(formatUnits(raw as bigint, decimals));
  const usd = tokenAmount * price;
  return usd;
};

const formatUSDValue = (value: number | null, isDecrypted: boolean, decimals = 2): string => {
  if (!isDecrypted) return '••••••••';
  if (value === null) return '—';
  if (Number.isNaN(value)) return 'Price unavailable';
  if (value < 0.01) return '< $0.01';
  if (value < 1000) return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: decimals }).format(value);
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 2 }).format(value);
};



const UserBorrowsSection: React.FC<UserBorrowsSectionProps> = ({
  borrowedBalances,
  suppliedBalances,
  assets,
  userCollateralEnabled,
  onRepayClick,
  isLoadingBorrowed,
  isDarkMode,
  onNavigateToMarkets,
}) => {
  const theme = useTheme();


  const positions = useMemo(() => {
    const entries = Object.entries(borrowedBalances || {}).filter(([, v]) => v && (v as BorrowedBalance).hasBorrowed);
    const mapped = entries.map(([symbol, bal]) => {
      const asset = assets.find(a => a.symbol === symbol);
      return {
        symbol,
        address: (asset?.address) || (bal as BorrowedBalance).address,
        decimals: asset?.decimals ?? (bal as BorrowedBalance).decimals ?? 18,
        formattedBorrowed: (bal as BorrowedBalance).formattedBorrowed,
        rawBorrowed: (bal as BorrowedBalance).rawBorrowed,
        isDecrypted: (bal as BorrowedBalance).isDecrypted,
        usdValue: asset ? calculateUSDValue((bal as BorrowedBalance).rawBorrowed, asset.decimals, asset.price) : null,
        icon: asset?.icon || '/assets/icons/unknown-token.svg',
        color: asset?.color || '#e74c3c',
        name: asset?.name || symbol,
        price: asset?.price,
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
  }, [borrowedBalances, assets]);

  if (isLoadingBorrowed) {
    return (
      <Box>
        {[1,2,3].map(i => (
          <Card key={i} sx={{
            mb: 2,
            p: 2,
            backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
            border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)'
          }}>
            <CardContent>
              <Typography variant="body2" sx={{ mb: 1, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)', height: 18, width: '60%', borderRadius: '4px' }} />
              <Typography variant="body2" sx={{ mb: 1, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)', height: 14, width: '40%', borderRadius: '4px' }} />
            </CardContent>
          </Card>
        ))}
      </Box>
    );
  }

  if (!positions || positions.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 6 }}>
        <Typography variant="h6" sx={{ mb: 1, color: isDarkMode ? 'white' : '#000000' }}>Enable collateral to borrow</Typography>
        <Typography variant="body2" sx={{ color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)', mb: 2 }}>Supply assets and enable them as collateral to start borrowing</Typography>
        <Button variant="contained" onClick={() => onNavigateToMarkets ? onNavigateToMarkets() : undefined}>Go to Markets</Button>
      </Box>
    );
  }

  return (
    <Box>
      {/* Desktop table */}
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
              <TableCell align="center" sx={{ color: isDarkMode ? 'white' : '#000000', fontWeight: 'bold' }}>Borrowed</TableCell>
              <TableCell align="center" sx={{ color: isDarkMode ? 'white' : '#000000', fontWeight: 'bold' }}>Value (USD)</TableCell>
              <TableCell align="center" sx={{ color: isDarkMode ? 'white' : '#000000', fontWeight: 'bold' }}>APY</TableCell>
              <TableCell align="center" sx={{ color: isDarkMode ? 'white' : '#000000', fontWeight: 'bold' }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {positions.map(p => (
              <TableRow key={p.symbol} hover>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 36, height: 36, borderRadius: '50%', background: p.color || theme.palette.background.paper, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {p.icon ? (
                        <Image src={p.icon} alt={p.symbol} width={20} height={20} />
                      ) : <Box />}
                    </Box>
                    <Box>
                      <Typography sx={{ fontWeight: 700, color: isDarkMode ? 'white' : '#000000' }}>{p.symbol}</Typography>
                      <Typography variant="caption" sx={{ color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>{p.name}</Typography>
                    </Box>
                  </Box>
                </TableCell>

                <TableCell align="center" sx={{ color: isDarkMode ? 'white' : '#000000' }}>
                  <Typography sx={{ color: isDarkMode ? 'white' : '#000000' }}>{p.isDecrypted ? p.formattedBorrowed : '••••••••'}</Typography>
                  <Typography variant="caption" sx={{ color: isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>{p.isDecrypted ? 'Decrypted' : 'Encrypted'}</Typography>
                </TableCell>

                <TableCell align="center" sx={{ color: isDarkMode ? 'white' : '#000000' }}>
                  <Typography sx={{ color: isDarkMode ? 'white' : '#000000' }}>{formatUSDValue(p.usdValue ?? null, p.isDecrypted)}</Typography>
                </TableCell>

                <TableCell align="center" sx={{ color: isDarkMode ? 'white' : '#000000' }}>
                  <Chip label="—" size="small" sx={{
                    color: isDarkMode ? 'white' : '#000000',
                    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(0, 0, 0, 0.2)'
                  }} />
                </TableCell>
            
                <TableCell align="center" sx={{ color: isDarkMode ? 'white' : '#000000' }}>
                  <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                    <Button variant="outlined" size="small" startIcon={<Send />} onClick={() => onRepayClick({ address: p.address, symbol: p.symbol, decimals: p.decimals, name: p.name, icon: p.icon, color: p.color, price: p.price })} aria-label={`Repay ${p.symbol}`} sx={{
                      borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)',
                      color: isDarkMode ? 'white' : '#000000',
                      '&:hover': {
                        borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)',
                        backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                      }
                    }}>
                      Repay
                    </Button>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>

      {/* Mobile cards */}
      <Box sx={{ display: { xs: 'block', md: 'none' } }}>
        {positions.map(p => (
          <Card key={p.symbol} sx={{
            mb: 2,
            borderRadius: 2,
            backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
            border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)'
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 40, height: 40, borderRadius: '50%', background: p.color || theme.palette.background.paper, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {p.icon ? (<Image src={p.icon} alt={p.symbol} width={20} height={20} />) : <Box />}
                  </Box>
                  <Box>
                    <Typography sx={{ fontWeight: 700, color: isDarkMode ? 'white' : '#000000' }}>{p.symbol}</Typography>
                    <Typography variant="caption" sx={{ color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>{p.name}</Typography>
                  </Box>
                </Box>
              </Box>

              <Grid container spacing={1} sx={{ mb: 2 }}>
                <Grid item xs={6}>
                  <Typography variant="caption" sx={{ color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>Borrowed</Typography>
                  <Typography sx={{ fontWeight: 600, color: isDarkMode ? 'white' : '#000000' }}>{p.isDecrypted ? p.formattedBorrowed : '••••••••'}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" sx={{ color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>Value</Typography>
                  <Typography sx={{ fontWeight: 600, color: isDarkMode ? 'white' : '#000000' }}>{formatUSDValue(p.usdValue ?? null, p.isDecrypted)}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" sx={{ color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>APY</Typography>
                  <Typography sx={{ fontWeight: 600, color: isDarkMode ? 'white' : '#000000' }}>—</Typography>
                </Grid>
              </Grid>

              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button fullWidth variant="contained" onClick={() => onRepayClick({ address: p.address, symbol: p.symbol, decimals: p.decimals, name: p.name, icon: p.icon, color: p.color, price: p.price })} startIcon={<Send />} sx={{
                  backgroundColor: isDarkMode ? '#2196f3' : '#1976d2',
                  color: 'white',
                  '&:hover': {
                    backgroundColor: isDarkMode ? '#1976d2' : '#1565c0',
                  }
                }}>
                  Repay
                </Button>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>
    </Box>
  );
};

export default UserBorrowsSection;
