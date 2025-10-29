'use client';

import { useState, useEffect } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Grid,
  Alert,
  CircularProgress,
  Switch,
  FormControlLabel,
  Stepper,
  Step,
  StepLabel,
  Divider,
} from '@mui/material';
import { Add, CheckCircle, TrendingUp, Link as LinkIcon } from '@mui/icons-material';
import { ADMIN_CONTRACTS } from '@/config/admin/adminContracts';
import { CONFIGURATOR_ABI, ORACLE_ABI } from '@/config/admin/adminABI';

export default function AddReservePanel() {
  const [activeStep, setActiveStep] = useState(0);
  
  // Link status
  const { data: linkedPool } = useReadContract({
    address: ADMIN_CONTRACTS.POOL_CONFIGURATOR as `0x${string}`,
    abi: CONFIGURATOR_ABI,
    functionName: 'lendingPool',
  });
  
  // Step 1: Reserve Config
  const [assetAddress, setAssetAddress] = useState('');
  const [assetSymbol, setAssetSymbol] = useState('');
  const [borrowingEnabled, setBorrowingEnabled] = useState(true);
  const [isCollateral, setIsCollateral] = useState(true);
  const [collateralFactor, setCollateralFactor] = useState('75');
  
  // Step 2: Price Config
  const [assetPrice, setAssetPrice] = useState('');

  const { writeContract: writeConfigurator, data: configHash, isPending: isConfigPending } = useWriteContract();
  const { isLoading: isConfigConfirming, isSuccess: isConfigSuccess } = useWaitForTransactionReceipt({ hash: configHash });

  // Separate writer for relink so it doesn't advance steps
  const { writeContract: writeLink, data: linkHash, isPending: isLinkPending } = useWriteContract();
  const { isLoading: isLinkConfirming, isSuccess: isLinkSuccess } = useWaitForTransactionReceipt({ hash: linkHash });

  const { writeContract: writeOracle, data: priceHash, isPending: isPricePending } = useWriteContract();
  const { isLoading: isPriceConfirming, isSuccess: isPriceSuccess } = useWaitForTransactionReceipt({ hash: priceHash });

  const steps = ['Reserve Configuration', 'Set Initial Price', 'Complete'];

  // Handle reserve initialization
  const handleInitReserve = () => {
    if (!assetAddress) {
      alert('Please enter asset address');
      return;
    }
    if (!linkedPool || linkedPool === '0x0000000000000000000000000000000000000000') {
      alert('Link Configurator to Pool first (setLendingPool).');
      return;
    }

    const ltvInE12 = BigInt(Math.floor(parseFloat(collateralFactor) * 1e10)); // Convert % to e12

    writeConfigurator({
      address: ADMIN_CONTRACTS.POOL_CONFIGURATOR as `0x${string}`,
      abi: CONFIGURATOR_ABI,
      functionName: 'initReserve',
      args: [
        assetAddress as `0x${string}`,
        borrowingEnabled,
        isCollateral,
        ltvInE12,
      ],
      gas: BigInt(500000),
    });
  };

  const handleLinkPool = () => {
    const poolAddr = ADMIN_CONTRACTS.LENDING_POOL as `0x${string}`;
    writeLink({
      address: ADMIN_CONTRACTS.POOL_CONFIGURATOR as `0x${string}`,
      abi: CONFIGURATOR_ABI,
      functionName: 'setLendingPool',
      args: [poolAddr],
      gas: BigInt(200000),
    });
  };

  // Handle price setting
  const handleSetPrice = () => {
    if (!assetAddress) {
      alert('Missing asset address. Please fill Step 1 and initialize reserve first.');
      return;
    }
    if (!assetPrice) {
      alert('Please enter asset price');
      return;
    }

    const priceInE12 = BigInt(Math.floor(parseFloat(assetPrice) * 1e12));

    writeOracle({
      address: ADMIN_CONTRACTS.PRICE_ORACLE as `0x${string}`,
      abi: ORACLE_ABI,
      functionName: 'setPrice',
      args: [assetAddress as `0x${string}`, priceInE12],
      gas: BigInt(300000),
    });
  };

  // Auto-advance to step 2 after successful reserve init
  useEffect(() => {
    if (isConfigSuccess) {
      setActiveStep(1);
    }
  }, [isConfigSuccess]);

  // Auto-advance to step 3 after successful price set
  useEffect(() => {
    if (isPriceSuccess) {
      setActiveStep(2);
    }
  }, [isPriceSuccess]);

  const handleReset = () => {
    setActiveStep(0);
    setAssetAddress('');
    setAssetSymbol('');
    setBorrowingEnabled(true);
    setIsCollateral(true);
    setCollateralFactor('75');
    setAssetPrice('');
  };

  return (
    <Card sx={{ background: 'rgba(255, 255, 255, 0.05)', backdropFilter: 'blur(10px)' }}>
      <CardContent>
        <Typography variant="h5" gutterBottom sx={{ color: 'white', mb: 3 }}>
          ➕ Add New Reserve
        </Typography>

        {/* Stepper */}
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel
                sx={{
                  '& .MuiStepLabel-label': { color: 'rgba(255, 255, 255, 0.6)' },
                  '& .Mui-active': { color: '#4fc3f7 !important' },
                  '& .Mui-completed': { color: '#51cf66 !important' },
                }}
              >
                {label}
              </StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* Step 1: Reserve Configuration */}
        {activeStep === 0 && (
          <Box>
            <Typography variant="h6" sx={{ color: 'white', mb: 3 }}>
              Step 1: Configure Reserve
            </Typography>
            <Grid container spacing={3}>
              {/* Link status */}
              <Grid item xs={12}>
                {linkedPool && linkedPool !== '0x0000000000000000000000000000000000000000' ? (
                  <Alert severity="success" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" sx={{ color: 'white', flex: 1 }}>
                      Linked to Pool: <code>{linkedPool}</code>
                    </Typography>
                    <Button 
                      variant="outlined" 
                      color="inherit"
                      size="small"
                      onClick={handleLinkPool}
                      startIcon={<LinkIcon />}
                    >
                      Relink
                    </Button>
                  </Alert>
                ) : (
                  <Alert severity="warning" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" sx={{ color: 'white', flex: 1 }}>
                      Configurator is not linked to Pool. Link before initializing reserves.
                    </Typography>
                    <Button 
                      variant="contained" 
                      color="primary"
                      size="small"
                      onClick={handleLinkPool}
                      startIcon={<LinkIcon />}
                    >
                      Link to Pool
                    </Button>
                  </Alert>
                )}
              </Grid>
              {/* Asset Address */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Asset Address"
                  value={assetAddress}
                  onChange={(e) => setAssetAddress(e.target.value)}
                  placeholder="0x..."
                  required
                  sx={{
                    '& .MuiInputLabel-root': { color: 'rgba(255, 255, 255, 0.7)' },
                    '& .MuiInputBase-input': { color: 'white', fontFamily: 'monospace' },
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.3)' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.5)' },
                  }}
                  helperText="Address of the confidential token (e.g., cDAI, cBTC)"
                />
              </Grid>

              {/* Asset Symbol */}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Symbol (for reference)"
                  value={assetSymbol}
                  onChange={(e) => setAssetSymbol(e.target.value)}
                  placeholder="cDAI"
                  sx={{
                    '& .MuiInputLabel-root': { color: 'rgba(255, 255, 255, 0.7)' },
                    '& .MuiInputBase-input': { color: 'white' },
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.3)' },
                  }}
                  helperText="Symbol for identification (not stored on-chain)"
                />
              </Grid>

              {/* Collateral Factor */}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Collateral Factor (LTV %)"
                  type="number"
                  value={collateralFactor}
                  onChange={(e) => setCollateralFactor(e.target.value)}
                  placeholder="75"
                  required
                  sx={{
                    '& .MuiInputLabel-root': { color: 'rgba(255, 255, 255, 0.7)' },
                    '& .MuiInputBase-input': { color: 'white' },
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.3)' },
                  }}
                  InputProps={{ endAdornment: '%' }}
                  helperText="Loan-to-Value ratio (e.g., 75 = can borrow up to 75% of collateral value)"
                />
              </Grid>

              {/* Switches */}
              <Grid item xs={12} md={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={borrowingEnabled}
                      onChange={(e) => setBorrowingEnabled(e.target.checked)}
                      sx={{
                        '& .MuiSwitch-switchBase.Mui-checked': { color: '#4fc3f7' },
                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#4fc3f7' },
                      }}
                    />
                  }
                  label={<Typography sx={{ color: 'white' }}>Enable Borrowing</Typography>}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={isCollateral}
                      onChange={(e) => setIsCollateral(e.target.checked)}
                      sx={{
                        '& .MuiSwitch-switchBase.Mui-checked': { color: '#4fc3f7' },
                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#4fc3f7' },
                      }}
                    />
                  }
                  label={<Typography sx={{ color: 'white' }}>Can Be Used as Collateral</Typography>}
                />
              </Grid>

              {/* Info */}
              <Grid item xs={12}>
                <Alert 
                  severity="info"
                  sx={{ 
                    background: 'rgba(33, 150, 243, 0.1)',
                    border: '1px solid rgba(33, 150, 243, 0.3)',
                  }}
                >
                  <Typography variant="body2" sx={{ color: 'white' }}>
                    <strong>💡 Info:</strong> This will initialize a new reserve in the lending pool. Make sure the asset is a valid ERC7984 confidential token.
                  </Typography>
                </Alert>
              </Grid>

              {/* Submit Button */}
              <Grid item xs={12}>
                <Button
                  variant="contained"
                  color="primary"
                  size="large"
                  onClick={handleInitReserve}
                  disabled={isConfigPending || isConfigConfirming || !assetAddress || !collateralFactor}
                  startIcon={isConfigPending || isConfigConfirming ? <CircularProgress size={20} /> : <Add />}
                  fullWidth
                  sx={{
                    py: 1.5,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)',
                    },
                  }}
                >
                  {isConfigPending ? 'Confirming...' : isConfigConfirming ? 'Initializing Reserve...' : 'Initialize Reserve'}
                </Button>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* Step 2: Set Price */}
        {activeStep === 1 && (
          <Box>
            <Typography variant="h6" sx={{ color: 'white', mb: 3 }}>
              Step 2: Set Initial Price
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Alert severity="success" icon={<CheckCircle />}>
                  <Typography variant="body2" sx={{ color: 'white' }}>
                    ✅ Reserve initialized successfully! Now set the initial price.
                  </Typography>
                </Alert>
              </Grid>

              <Grid item xs={12}>
                <Card sx={{ background: 'rgba(0, 0, 0, 0.2)', p: 2 }}>
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1 }}>
                    Asset: <strong>{assetSymbol || assetAddress.slice(0, 10) + '...'}</strong>
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                    LTV: {collateralFactor}% | Borrowing: {borrowingEnabled ? 'Enabled' : 'Disabled'} | Collateral: {isCollateral ? 'Yes' : 'No'}
                  </Typography>
                </Card>
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Initial Price (USD)"
                  type="number"
                  value={assetPrice}
                  onChange={(e) => setAssetPrice(e.target.value)}
                  placeholder="1"
                  required
                  sx={{
                    '& .MuiInputLabel-root': { color: 'rgba(255, 255, 255, 0.7)' },
                    '& .MuiInputBase-input': { color: 'white' },
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.3)' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.5)' },
                  }}
                  InputProps={{
                    startAdornment: <Typography sx={{ color: 'rgba(255, 255, 255, 0.5)', mr: 1 }}>$</Typography>,
                  }}
                  helperText="Enter the initial price in USD (e.g., 1 for stablecoins, 2000 for ETH)"
                />
              </Grid>

              <Grid item xs={12}>
                <Alert 
                  severity="warning"
                  sx={{ 
                    background: 'rgba(255, 152, 0, 0.1)',
                    border: '1px solid rgba(255, 152, 0, 0.3)',
                  }}
                >
                  <Typography variant="body2" sx={{ color: 'white' }}>
                    <strong>⚠️ Important:</strong> Set an accurate initial price. Users can immediately start supplying once the price is set.
                  </Typography>
                </Alert>
              </Grid>

              <Grid item xs={12}>
                <Button
                  variant="contained"
                  color="primary"
                  size="large"
                  onClick={handleSetPrice}
                  disabled={isPricePending || isPriceConfirming || !assetPrice}
                  startIcon={isPricePending || isPriceConfirming ? <CircularProgress size={20} /> : <TrendingUp />}
                  fullWidth
                  sx={{
                    py: 1.5,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)',
                    },
                  }}
                >
                  {isPricePending ? 'Confirming...' : isPriceConfirming ? 'Setting Price...' : 'Set Initial Price'}
                </Button>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* Step 3: Complete */}
        {activeStep === 2 && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CheckCircle sx={{ fontSize: 80, color: '#51cf66', mb: 2 }} />
            <Typography variant="h4" sx={{ color: 'white', mb: 2 }}>
              Reserve Added Successfully!
            </Typography>
            <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 3 }}>
              {assetSymbol || 'The new asset'} is now available for users to supply and borrow.
            </Typography>
            
            <Card sx={{ background: 'rgba(76, 175, 80, 0.1)', border: '1px solid rgba(76, 175, 80, 0.3)', mb: 3, p: 2 }}>
              <Typography variant="body2" sx={{ color: 'white', mb: 1 }}>
                <strong>Asset:</strong> {assetAddress}
              </Typography>
              <Typography variant="body2" sx={{ color: 'white', mb: 1 }}>
                <strong>Symbol:</strong> {assetSymbol}
              </Typography>
              <Typography variant="body2" sx={{ color: 'white', mb: 1 }}>
                <strong>Initial Price:</strong> ${assetPrice}
              </Typography>
              <Typography variant="body2" sx={{ color: 'white', mb: 1 }}>
                <strong>LTV:</strong> {collateralFactor}%
              </Typography>
              <Typography variant="body2" sx={{ color: 'white', mb: 1 }}>
                <strong>Borrowing:</strong> {borrowingEnabled ? 'Enabled ✅' : 'Disabled ❌'}
              </Typography>
              <Typography variant="body2" sx={{ color: 'white' }}>
                <strong>Collateral:</strong> {isCollateral ? 'Yes ✅' : 'No ❌'}
              </Typography>
            </Card>

            <Alert severity="success" sx={{ mb: 3 }}>
              <Typography variant="body2">
                <strong>Next Steps:</strong> Users can now supply {assetSymbol || 'this asset'} to the protocol. You can configure additional parameters in the "Configure" tab.
              </Typography>
            </Alert>

            <Button
              variant="contained"
              onClick={handleReset}
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)',
                },
              }}
            >
              Add Another Reserve
            </Button>
          </Box>
        )}

        {/* Help Section */}
        {activeStep === 0 && (
          <Box sx={{ mt: 4 }}>
            <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.1)', mb: 2 }} />
            <Typography variant="h6" sx={{ color: 'white', mb: 2 }}>
              📚 How to Add a New Token
            </Typography>
            <Alert 
              severity="info"
              sx={{ 
                background: 'rgba(33, 150, 243, 0.1)',
                border: '1px solid rgba(33, 150, 243, 0.3)',
                mb: 2,
              }}
            >
              <Typography variant="body2" sx={{ color: 'white', mb: 1 }}>
                <strong>Prerequisites:</strong>
              </Typography>
              <Typography variant="body2" component="div" sx={{ color: 'white', pl: 2 }}>
                1. Deploy a confidential ERC7984 token (e.g., cDAI, cBTC)<br />
                2. Add metadata to <code>webapp/src/config/tokenMetadata.ts</code><br />
                3. Add icon to <code>webapp/public/assets/icons/</code><br />
                4. Have the deployed contract address<br />
                5. Know the appropriate LTV for the asset<br />
                6. Have the current market price
              </Typography>
            </Alert>

            <Alert 
              severity="success"
              sx={{ 
                background: 'rgba(76, 175, 80, 0.1)',
                border: '1px solid rgba(76, 175, 80, 0.3)',
                mb: 2,
              }}
            >
              <Typography variant="body2" sx={{ color: 'white', mb: 1 }}>
                <strong>📝 Add to tokenMetadata.ts:</strong>
              </Typography>
              <Box component="pre" sx={{ 
                color: 'white', 
                background: 'rgba(0, 0, 0, 0.3)', 
                p: 2, 
                borderRadius: 1,
                overflow: 'auto',
                fontSize: '0.75rem',
                fontFamily: 'monospace'
              }}>
{`[CONTRACTS.CONFIDENTIAL_${assetSymbol ? assetSymbol.toUpperCase().replace('C', '') : 'TOKEN'}]: {
  symbol: '${assetSymbol || 'cTOKEN'}',
  name: 'Confidential ${assetSymbol ? assetSymbol.substring(1) : 'Token'}',
  decimals: 18,
  icon: '/assets/icons/${assetSymbol ? assetSymbol.toLowerCase() : 'token'}.svg',
  color: '#627EEA',
  underlying: CONTRACTS.${assetSymbol ? assetSymbol.toUpperCase().replace('C', '') : 'TOKEN'},
  description: 'Privacy-preserving token',
},`}
              </Box>
            </Alert>

            <Alert 
              severity="warning"
              sx={{ 
                background: 'rgba(255, 152, 0, 0.1)',
                border: '1px solid rgba(255, 152, 0, 0.3)',
              }}
            >
              <Typography variant="body2" sx={{ color: 'white', mb: 1 }}>
                <strong>⚠️ Recommended LTV Values:</strong>
              </Typography>
              <Typography variant="body2" component="div" sx={{ color: 'white', pl: 2 }}>
                • Stablecoins (DAI, USDC): 80-85%<br />
                • ETH/WETH: 75-80%<br />
                • BTC: 70-75%<br />
                • Volatile assets: 50-60%
              </Typography>
            </Alert>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

