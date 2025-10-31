'use client';

import { Box, Card, CardContent, Typography } from '@mui/material';
import TokenBalanceCard from './TokenBalanceCard';
import { FhevmDecryptionSignature } from '../utils/FhevmDecryptionSignature';

interface AvailableAsset {
  address: string;
  symbol: string;
  decimals: number;
  name: string;
  icon: string;
  color: string;
}

interface WalletAssetBreakdownProps {
  availableAssets: AvailableAsset[];
  masterSignature: string | null;
  getMasterSignature: () => FhevmDecryptionSignature | null;
  isDarkMode: boolean;
}

export default function WalletAssetBreakdown({
  availableAssets,
  masterSignature,
  getMasterSignature,
  isDarkMode
}: WalletAssetBreakdownProps) {

  console.log('🔍 WalletAssetBreakdown - availableAssets:', availableAssets);
  console.log('🔍 WalletAssetBreakdown - availableAssets.length:', availableAssets.length);

  if (availableAssets.length === 0) {
    return (
      <Card sx={{
        flexGrow: 1,
        width: '50%',
        mb: 1,
        background: isDarkMode
          ? 'rgba(255, 255, 255, 0.08)'
          : 'rgba(44, 62, 80, 0.08)',
        border: isDarkMode
          ? '2px solid rgba(255, 255, 255, 0.2)'
          : '2px solid rgba(44, 62, 80, 0.3)',
        boxShadow: isDarkMode
          ? '0 2px 8px rgba(0, 0, 0, 0.2)'
          : '0 2px 8px rgba(44, 62, 80, 0.1)'
      }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{
            fontWeight: '600',
            mb: 3,
            color: isDarkMode ? 'white' : '#000000',
            fontFamily: 'sans-serif'
          }}>
            Wallet Assets
          </Typography>
          <Typography variant="body2" sx={{ color: isDarkMode ? 'white' : '#000000', opacity: 0.7, textAlign: 'center', py: 4 }}>
            No confidential tokens in wallet
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{
      flexGrow: 1,
      width: '50%',
      mb: 1,
      background: isDarkMode
        ? 'rgba(255, 255, 255, 0.08)'
        : 'rgba(44, 62, 80, 0.08)',
      border: isDarkMode
        ? '2px solid rgba(255, 255, 255, 0.2)'
        : '2px solid rgba(44, 62, 80, 0.3)',
      boxShadow: isDarkMode
        ? '0 2px 8px rgba(0, 0, 0, 0.2)'
        : '0 2px 8px rgba(44, 62, 80, 0.1)'
    }}>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h6" sx={{
          fontWeight: '600',
          mb: 3,
          color: isDarkMode ? 'white' : '#000000',
          fontFamily: 'sans-serif'
        }}>
          Wallet Assets
        </Typography>

        {/* Table Structure */}
        <Box sx={{
          overflowX: 'auto',
          '& table': {
            width: '100%',
            borderCollapse: 'collapse',
            border: isDarkMode
              ? '1px solid rgba(255, 255, 255, 0.1)'
              : '1px solid rgba(44, 62, 80, 0.1)',
            borderRadius: '8px',
            overflow: 'hidden',
            '@media (max-width: 600px)': {
              fontSize: '0.75rem',
              '& th, & td': {
                padding: '8px 10px',
              }
            }
          },
          '& th, & td': {
            padding: '12px 16px',
            textAlign: 'left',
            borderBottom: isDarkMode
              ? '1px solid rgba(255, 255, 255, 0.1)'
              : '1px solid rgba(44, 62, 80, 0.1)',
            '@media (max-width: 600px)': {
              padding: '8px 10px',
            }
          },
          '& th': {
            background: isDarkMode
              ? 'rgba(255, 255, 255, 0.08)'
              : 'rgba(44, 62, 80, 0.08)',
            fontWeight: '600',
            fontSize: '0.875rem',
            color: isDarkMode ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)',
            '@media (max-width: 600px)': {
              fontSize: '0.75rem',
              padding: '8px 10px',
            }
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
                <th style={{ width: '150px', textAlign: 'center' }}>Balance</th>
                <th style={{ width: '100px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {availableAssets.map((asset) => (
                <TokenBalanceCard
                  key={asset.symbol}
                  asset={asset}
                  masterSignature={masterSignature}
                  getMasterSignature={getMasterSignature}
                  isDarkMode={isDarkMode}
                />
              ))}
            </tbody>
          </table>
        </Box>
      </CardContent>
    </Card>
  );
}

