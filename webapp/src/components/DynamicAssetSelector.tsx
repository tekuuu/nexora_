'use client';

import { Box, Typography, Button, Chip, CircularProgress, Alert, Switch, FormControlLabel, Tooltip } from '@mui/material';
import { AvailableAsset } from '../hooks/useAvailableReserves';
import { useAccount } from 'wagmi';
import { useCollateralToggle } from '../hooks/useCollateralToggle';
import { Lock, LockOpen } from '@mui/icons-material';

interface DynamicAssetSelectorProps {
  assets: AvailableAsset[];
  mode: 'supply' | 'borrow';
  onSelectAsset: (asset: AvailableAsset) => void;
  isDarkMode?: boolean;
  isLoading?: boolean;
}

// Asset card component for mobile view
function AssetCard({
  asset,
  mode,
  onSelectAsset,
  isDarkMode,
  userAddress
}: {
  asset: AvailableAsset;
  mode: 'supply' | 'borrow';
  onSelectAsset: (asset: AvailableAsset) => void;
  isDarkMode: boolean;
  userAddress: string | undefined;
}) {
  const {
    isCollateralEnabled,
    isLoadingStatus,
    toggleCollateral,
    isPending,
    isSuccess,
    transactionError
  } = useCollateralToggle({
    assetAddress: asset.address,
    userAddress,
    enabled: asset.isCollateral && mode === 'supply' // Only for supply mode and collateral assets
  });

  const handleToggleCollateral = async (event: React.ChangeEvent<HTMLInputElement>) => {
    event.stopPropagation();
    const newValue = event.target.checked;
    console.log(`🔄 Toggling collateral for ${asset.symbol}:`, newValue);
    await toggleCollateral(newValue);
  };

  return (
    <Box
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
          : '0 4px 12px rgba(0, 0, 0, 0.08)',
        cursor: 'pointer',
        '&:hover': {
          background: isDarkMode
            ? 'rgba(255, 255, 255, 0.08)'
            : 'rgba(44, 62, 80, 0.05)'
        },
        transition: 'all 0.3s ease'
      }}
      onClick={() => onSelectAsset(asset)}
    >
      {/* Asset Header */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        p: 2,
        pb: 1,
        borderBottom: isDarkMode
          ? '1px solid rgba(255, 255, 255, 0.1)'
          : '1px solid rgba(44, 62, 80, 0.1)'
      }}>
        <img
          src={asset.icon}
          alt={asset.symbol}
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
          }}
        />
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem' }}>
            {asset.symbol}
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.7, fontSize: '0.75rem' }}>
            {asset.name}
          </Typography>
        </Box>
      </Box>

      {/* Key Metrics Section */}
      <Box sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        px: 2,
        py: 1.5,
        background: isDarkMode
          ? 'rgba(255, 255, 255, 0.03)'
          : 'rgba(44, 62, 80, 0.03)',
        borderBottom: isDarkMode
          ? '1px solid rgba(255, 255, 255, 0.05)'
          : '1px solid rgba(44, 62, 80, 0.05)'
      }}>
        {/* APY */}
        <Box sx={{ textAlign: 'center', flex: 1 }}>
          <Typography variant="caption" sx={{
            opacity: 0.7,
            fontSize: '0.65rem',
            color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(44, 62, 80, 0.7)',
            display: 'block',
            mb: 0.5
          }}>
            APY
          </Typography>
          <Typography variant="body2" sx={{
            fontWeight: '700',
            fontSize: '0.9rem',
            color: isDarkMode ? '#4caf50' : '#2e7d32'
          }}>
            5.0%
          </Typography>
        </Box>

        {/* Price */}
        <Box sx={{ textAlign: 'center', flex: 1 }}>
          <Typography variant="caption" sx={{
            opacity: 0.7,
            fontSize: '0.65rem',
            color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(44, 62, 80, 0.7)',
            display: 'block',
            mb: 0.5
          }}>
            Price
          </Typography>
          <Typography variant="body2" sx={{
            fontWeight: '600',
            fontSize: '0.85rem',
            color: isDarkMode ? 'white' : '#000000'
          }}>
            ${asset.price.toLocaleString()}
          </Typography>
        </Box>

        {/* Collateral Info - Supply mode only */}
        {mode === 'supply' && (
          <Box sx={{ textAlign: 'center', flex: 1 }}>
            <Typography variant="caption" sx={{
              opacity: 0.7,
              fontSize: '0.65rem',
              color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(44, 62, 80, 0.7)',
              display: 'block',
              mb: 0.5
            }}>
              Collateral
            </Typography>
            {asset.isCollateral ? (
              <Chip
                label={`${asset.ltv.toFixed(0)}% LTV`}
                size="small"
                sx={{
                  height: '20px',
                  fontSize: '0.65rem',
                  background: `${asset.color}30`,
                  color: isDarkMode ? 'white' : asset.color,
                  fontWeight: 700
                }}
              />
            ) : (
              <Typography variant="caption" sx={{
                opacity: 0.6,
                fontSize: '0.7rem'
              }}>
                —
              </Typography>
            )}
          </Box>
        )}
      </Box>

      {/* Collateral Toggle Section - Supply mode only */}
      {mode === 'supply' && (
        <Box sx={{
          px: 2,
          py: 1.5,
          borderBottom: isDarkMode
            ? '1px solid rgba(255, 255, 255, 0.05)'
            : '1px solid rgba(44, 62, 80, 0.05)'
        }}>
          {asset.isCollateral ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {isCollateralEnabled ? (
                  <LockOpen sx={{ fontSize: '1.1rem', color: '#4caf50' }} />
                ) : (
                  <Lock sx={{ fontSize: '1.1rem', opacity: 0.5 }} />
                )}
                <Typography variant="body2" sx={{
                  fontSize: '0.8rem',
                  opacity: 0.8,
                  color: isDarkMode ? 'rgba(255, 255, 255, 0.8)' : 'rgba(44, 62, 80, 0.8)'
                }}>
                  Collateral {isCollateralEnabled ? 'Enabled' : 'Disabled'}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Tooltip
                  title={isPending ? "Processing..." : isCollateralEnabled ? "Click to disable as collateral" : "Click to enable as collateral"}
                  arrow
                >
                  <Switch
                    checked={isCollateralEnabled || false}
                    onChange={handleToggleCollateral}
                    disabled={isLoadingStatus || isPending}
                    size="small"
                    onClick={(e) => e.stopPropagation()}
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': {
                        color: '#4caf50',
                      },
                      '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                        backgroundColor: '#4caf50',
                      },
                    }}
                  />
                </Tooltip>
                {isPending && (
                  <CircularProgress size={14} sx={{ color: '#2196f3' }} />
                )}
              </Box>
            </Box>
          ) : (
            <Typography variant="body2" sx={{
              opacity: 0.6,
              fontSize: '0.8rem',
              textAlign: 'center'
            }}>
              Not available as collateral
            </Typography>
          )}
        </Box>
      )}

      {/* Action Button */}
      <Box sx={{
        p: 2,
        pt: 1.5,
        display: 'flex',
        justifyContent: 'center'
      }}>
        <Button
          variant="contained"
          size="medium"
          onClick={(e) => {
            e.stopPropagation();
            onSelectAsset(asset);
          }}
          sx={{
            background: mode === 'supply'
              ? 'linear-gradient(135deg, #2196f3 0%, #1976d2 100%)'
              : 'linear-gradient(135deg, #9c27b0 0%, #7b1fa2 100%)',
            color: 'white',
            px: 3,
            py: 1.2,
            borderRadius: '0px',
            textTransform: 'none',
            fontSize: '0.85rem',
            fontWeight: '600',
            minWidth: '120px',
            maxWidth: '160px',
            height: '40px',
            boxShadow: isDarkMode
              ? '0 4px 12px rgba(33, 150, 243, 0.3)'
              : '0 4px 12px rgba(33, 150, 243, 0.2)',
            '&:hover': {
              background: mode === 'supply'
                ? 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)'
                : 'linear-gradient(135deg, #7b1fa2 0%, #6a1b9a 100%)',
              boxShadow: isDarkMode
                ? '0 6px 16px rgba(33, 150, 243, 0.4)'
                : '0 6px 16px rgba(33, 150, 243, 0.3)',
              transform: 'translateY(-1px)'
            },
            '&:active': {
              transform: 'translateY(0px)'
            },
            transition: 'all 0.3s ease'
          }}
        >
          {mode === 'supply' ? 'Supply' : 'Borrow'}
        </Button>
      </Box>
    </Box>
  );
}

// Asset row component with collateral toggle
function AssetRow({
  asset,
  mode,
  onSelectAsset,
  isDarkMode,
  userAddress
}: {
  asset: AvailableAsset;
  mode: 'supply' | 'borrow';
  onSelectAsset: (asset: AvailableAsset) => void;
  isDarkMode: boolean;
  userAddress: string | undefined;
}) {
  const { 
    isCollateralEnabled, 
    isLoadingStatus, 
    toggleCollateral, 
    isPending,
    isSuccess,
    transactionError 
  } = useCollateralToggle({
    assetAddress: asset.address,
    userAddress,
    enabled: asset.isCollateral && mode === 'supply' // Only for supply mode and collateral assets
  });

  const handleToggleCollateral = async (event: React.ChangeEvent<HTMLInputElement>) => {
    event.stopPropagation();
    const newValue = event.target.checked;
    console.log(`🔄 Toggling collateral for ${asset.symbol}:`, newValue);
    await toggleCollateral(newValue);
  };

  return (
    <tr style={{ cursor: 'pointer' }} onClick={() => onSelectAsset(asset)}>
      {/* Asset column */}
      <td>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <img
            src={asset.icon}
            alt={asset.symbol}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
            }}
          />
          <Box>
            <Typography variant="body1" sx={{ fontWeight: 600 }}>
              {asset.symbol}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              {asset.name}
            </Typography>
          </Box>
        </Box>
      </td>

      {/* Collateral Info */}
      {mode === 'supply' && (
        <td style={{ textAlign: 'center' }}>
          {asset.isCollateral ? (
            <Chip
              label={`${asset.ltv.toFixed(0)}% LTV`}
              size="small"
              sx={{
                background: `${asset.color}30`,
                color: isDarkMode ? 'white' : asset.color,
                fontWeight: 600,
              }}
            />
          ) : (
            <Typography variant="body2" sx={{ opacity: 0.6 }}>
              —
            </Typography>
          )}
        </td>
      )}

      {/* APY */}
      <td style={{ textAlign: 'center' }}>
        <Typography variant="body2" sx={{ fontWeight: '600', color: isDarkMode ? 'white' : '#000000' }}>
          5.0%
        </Typography>
      </td>

      {/* Price */}
      <td style={{ textAlign: 'center' }}>
        <Typography variant="body2" sx={{ fontWeight: '600' }}>
          ${asset.price.toLocaleString()}
        </Typography>
      </td>

      {/* Collateral Toggle (Supply mode only, for collateral-enabled assets) */}
      {mode === 'supply' && (
        <td style={{ textAlign: 'center' }}>
          {asset.isCollateral ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
              <Tooltip
                title={isPending ? "Processing..." : isCollateralEnabled ? "Click to disable as collateral" : "Click to enable as collateral"}
                arrow
              >
                <FormControlLabel
                  control={
                    <Switch
                      checked={isCollateralEnabled || false}
                      onChange={handleToggleCollateral}
                      disabled={isLoadingStatus || isPending}
                      size="small"
                      onClick={(e) => e.stopPropagation()}
                      sx={{
                        '& .MuiSwitch-switchBase.Mui-checked': {
                          color: '#4caf50',
                        },
                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                          backgroundColor: '#4caf50',
                        },
                      }}
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {isCollateralEnabled ? (
                        <LockOpen sx={{ fontSize: '1rem', color: '#4caf50' }} />
                      ) : (
                        <Lock sx={{ fontSize: '1rem', opacity: 0.5 }} />
                      )}
                      <Typography variant="caption" sx={{ fontSize: '0.75rem', opacity: 0.8 }}>
                        Collateral
                      </Typography>
                    </Box>
                  }
                  labelPlacement="end"
                  sx={{ m: 0 }}
                />
              </Tooltip>
              {isPending && (
                <CircularProgress size={16} sx={{ color: '#2196f3' }} />
              )}
            </Box>
          ) : (
            <Typography variant="body2" sx={{ opacity: 0.6 }}>
              —
            </Typography>
          )}
        </td>
      )}

      {/* Action Button */}
      <td>
        <Button
          variant="contained"
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            onSelectAsset(asset);
          }}
          sx={{
            background: mode === 'supply'
              ? 'linear-gradient(135deg, #2196f3 0%, #1976d2 100%)'
              : 'linear-gradient(135deg, #9c27b0 0%, #7b1fa2 100%)',
            color: 'white',
            px: 2,
            py: 0.5,
            borderRadius: '0px',
            textTransform: 'none',
            fontSize: '0.8rem',
            fontWeight: '600',
            width: '100%',
            '&:hover': {
              background: mode === 'supply'
                ? 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)'
                : 'linear-gradient(135deg, #7b1fa2 0%, #6a1b9a 100%)',
            },
          }}
        >
          {mode === 'supply' ? 'Supply' : 'Borrow'}
        </Button>
      </td>
    </tr>
  );
}

export default function DynamicAssetSelector({ 
  assets, 
  mode, 
  onSelectAsset, 
  isDarkMode = false,
  isLoading = false 
}: DynamicAssetSelectorProps) {
  const { address: userAddress } = useAccount();
  
  console.log(`🔍 DynamicAssetSelector (${mode}) - assets:`, assets);
  console.log(`🔍 DynamicAssetSelector (${mode}) - isLoading:`, isLoading);

  if (isLoading) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <CircularProgress />
        <Typography sx={{ mt: 2, color: isDarkMode ? 'white' : '#2c3e50' }}>
          Loading available assets...
        </Typography>
      </Box>
    );
  }

  if (assets.length === 0) {
    return (
      <Alert severity="info">
        <Typography variant="body2">
          No assets available for {mode}. Admin needs to initialize reserves.
        </Typography>
      </Alert>
    );
  }

  return (
    <Box>
      {/* Desktop Table View - Hidden on small screens */}
      <Box sx={{
        display: { xs: 'none', md: 'block' },
        overflowX: 'auto',
        '& table': {
          width: '100%',
          borderCollapse: 'collapse',
          border: isDarkMode
            ? '1px solid rgba(255, 255, 255, 0.1)'
            : '1px solid rgba(44, 62, 80, 0.1)',
          borderRadius: '0px',
          overflow: 'hidden'
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
              {mode === 'supply' && <th style={{ width: '100px', textAlign: 'center' }}>Collateral</th>}
              <th style={{ width: '100px', textAlign: 'center' }}>APY</th>
              <th style={{ width: '120px', textAlign: 'center' }}>Price</th>
              {mode === 'supply' && <th style={{ width: '140px', textAlign: 'center' }}>Collateral Toggle</th>}
              <th style={{ width: '100px' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((asset) => (
              <AssetRow
                key={asset.address}
                asset={asset}
                mode={mode}
                onSelectAsset={onSelectAsset}
                isDarkMode={isDarkMode}
                userAddress={userAddress}
              />
            ))}
          </tbody>
        </table>
      </Box>

      {/* Mobile Card View - Hidden on medium screens and up */}
      <Box sx={{
        display: { xs: 'flex', sm: 'flex', md: 'none' },
        flexDirection: 'column',
        gap: 2
      }}>
        {assets.map((asset) => (
          <AssetCard
            key={asset.address}
            asset={asset}
            mode={mode}
            onSelectAsset={onSelectAsset}
            isDarkMode={isDarkMode}
            userAddress={userAddress}
          />
        ))}
      </Box>
    </Box>
  );
}

