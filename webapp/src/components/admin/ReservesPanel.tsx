'use client';

import { useReadContract } from 'wagmi';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
} from '@mui/material';
import { CheckCircle, Cancel, Pause, PlayArrow } from '@mui/icons-material';
import { ADMIN_CONTRACTS, RESERVE_TOKENS } from '@/config/admin/adminContracts';
import { CONFIGURATOR_ABI, ORACLE_ABI } from '@/config/admin/adminABI';
import { POOL_ABI } from '@/config/poolABI';

function ReserveRow({ name, address }: { name: string; address: string }) {
  const { data: reserveData } = useReadContract({
    address: ADMIN_CONTRACTS.POOL_CONFIGURATOR as `0x${string}`,
    abi: CONFIGURATOR_ABI,
    functionName: 'getReserveConfig',
    args: [address as `0x${string}`],
  });

  // Read pool-side initialization status
  const { data: poolReserveData } = useReadContract({
    address: ADMIN_CONTRACTS.LENDING_POOL as `0x${string}`,
    abi: POOL_ABI,
    functionName: 'getReserveData',
    args: [address as `0x${string}`],
  });

  const { data: price } = useReadContract({
    address: ADMIN_CONTRACTS.PRICE_ORACLE as `0x${string}`,
    abi: ORACLE_ABI,
    functionName: 'getPrice',
    args: [address as `0x${string}`],
  });

  if (!reserveData) {
    return (
      <TableRow>
        <TableCell>{name}</TableCell>
        <TableCell colSpan={7}>
          <CircularProgress size={20} />
        </TableCell>
      </TableRow>
    );
  }

  const reserve = reserveData as any;
  const poolReserve = poolReserveData as any;
  const isInitialized = !!(poolReserve && poolReserve.underlyingAsset && poolReserve.underlyingAsset !== '0x0000000000000000000000000000000000000000');
  const ltv = reserve.collateralFactor ? Number(reserve.collateralFactor) / 1e12 * 100 : 0;
  const priceUSD = price ? Number(price) / 1e12 : 0;

  return (
    <TableRow hover>
      <TableCell>
        <Typography variant="body1" fontWeight={600}>{name}</Typography>
        <Typography variant="caption" color="text.secondary">
          {address.slice(0, 6)}...{address.slice(-4)}
        </Typography>
      </TableCell>
      <TableCell>
        <Chip
          label={isInitialized ? 'Initialized' : 'Not Initialized'}
          color={isInitialized ? 'success' : 'default'}
          size="small"
          sx={{ mr: 1 }}
        />
        <Chip
          icon={reserve.active ? <CheckCircle /> : <Cancel />}
          label={reserve.active ? 'Active' : 'Inactive'}
          color={reserve.active ? 'success' : 'default'}
          size="small"
        />
      </TableCell>
      <TableCell>
        <Chip
          label={reserve.borrowingEnabled ? 'Enabled' : 'Disabled'}
          color={reserve.borrowingEnabled ? 'primary' : 'default'}
          size="small"
        />
      </TableCell>
      <TableCell>
        <Chip
          label={reserve.isCollateral ? 'Yes' : 'No'}
          color={reserve.isCollateral ? 'info' : 'default'}
          size="small"
        />
      </TableCell>
      <TableCell>
        <Typography variant="body2" fontWeight={600}>
          {ltv.toFixed(0)}%
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" fontWeight={600}>
          ${priceUSD.toLocaleString()}
        </Typography>
      </TableCell>
      <TableCell>
        {reserve.isPaused ? (
          <Chip
            icon={<Pause />}
            label="PAUSED"
            color="error"
            size="small"
          />
        ) : (
          <Chip
            icon={<PlayArrow />}
            label="Running"
            color="success"
            size="small"
          />
        )}
      </TableCell>
    </TableRow>
  );
}

export default function ReservesPanel() {
  return (
    <Card sx={{ background: 'rgba(255, 255, 255, 0.05)', backdropFilter: 'blur(10px)' }}>
      <CardContent>
        <Typography variant="h5" gutterBottom sx={{ color: 'white', mb: 3 }}>
          📊 Reserves Overview
        </Typography>
        <TableContainer component={Paper} sx={{ background: 'rgba(0, 0, 0, 0.2)' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ color: 'white', fontWeight: 700 }}>Asset</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 700 }}>Active</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 700 }}>Borrowing</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 700 }}>Collateral</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 700 }}>LTV</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 700 }}>Price</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 700 }}>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {RESERVE_TOKENS.map((reserve) => (
                <ReserveRow key={reserve.address} name={reserve.name} address={reserve.address} />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
}


