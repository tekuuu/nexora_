'use client';

import { Box, Typography, IconButton, Tooltip, CircularProgress } from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { useConfidentialTokenBalance } from '../hooks/useConfidentialTokenBalance';
import { FhevmDecryptionSignature } from '../utils/FhevmDecryptionSignature';

interface TokenBalanceCardProps {
  asset: {
    address: string;
    symbol: string;
    decimals: number;
    name: string;
    icon: string;
    color: string;
  };
  masterSignature: string | null;
  getMasterSignature: () => FhevmDecryptionSignature | null;
  isDarkMode: boolean;
}

export default function TokenBalanceCard({
  asset,
  masterSignature,
  getMasterSignature,
  isDarkMode
}: TokenBalanceCardProps) {
  const theme = useTheme();

  // Each card has its own balance hook - on-demand decryption!
  const {
    formattedBalance,
    hasConfidentialToken,
    isDecrypted,
    isDecrypting,
    decryptBalance
  } = useConfidentialTokenBalance(
    asset,
    masterSignature,
    getMasterSignature
  );

  return (
    <tr>
      {/* Asset column */}
      <td>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <img
            src={asset.icon}
            alt={asset.symbol}
            style={{ width: '32px', height: '32px' }}
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/assets/icons/default-token.svg';
            }}
          />
          <Box>
            <Typography variant="body2" sx={{
              fontWeight: '600',
              fontFamily: 'sans-serif',
              color: isDarkMode ? 'white' : '#000000'
            }}>
              {asset.symbol}
            </Typography>
            <Typography variant="caption" sx={{
              color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
              fontSize: '0.75rem'
            }}>
              {asset.name}
            </Typography>
          </Box>
        </Box>
      </td>

      {/* Balance column */}
      <td style={{ textAlign: 'center' }}>
        <Typography variant="body2" sx={{
          fontWeight: '600',
          fontFamily: 'monospace',
          color: isDarkMode ? 'white' : '#000000'
        }}>
          {isDecrypting ? (
            <CircularProgress size={16} sx={{ ml: 1 }} />
          ) : (
            formattedBalance || '0.00'
          )}
        </Typography>
      </td>

      {/* Actions column */}
      <td style={{ textAlign: 'center' }}>
        <Tooltip title={isDecrypted ? "Hide balance" : "Show balance"}>
          <IconButton
            size="small"
            onClick={decryptBalance}
            disabled={isDecrypting}
            sx={{
              color: isDecrypted
                ? '#2196f3'
                : isDarkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
              '&:hover': {
                background: isDarkMode
                  ? 'rgba(255, 255, 255, 0.1)'
                  : 'rgba(0, 0, 0, 0.05)',
              }
            }}
          >
            {isDecrypted ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
          </IconButton>
        </Tooltip>
      </td>
    </tr>
  );
}

