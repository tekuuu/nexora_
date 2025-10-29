'use client';

import { useState, useEffect } from 'react';
import { useAccount, useBalance, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { CONTRACTS, TOKEN_INFO } from '../config/contracts';
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Divider,
  Chip,
  IconButton,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import { SwapHoriz, AccountBalance, SwapVert, Close } from '@mui/icons-material';

// Contract ABIs
const SWAPPER_ABI = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "erc20Token",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "to",
        "type": "address"
      }
    ],
    "name": "swapERC20ToConfidential",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "confidentialToken",
        "type": "address"
      },
      {
        "internalType": "externalEuint64",
        "name": "encryptedAmount",
        "type": "bytes32"
      },
      {
        "internalType": "bytes",
        "name": "inputProof",
        "type": "bytes"
      }
    ],
    "name": "swapConfidentialToERC20",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "erc20Token",
        "type": "address"
      }
    ],
    "name": "getConfidentialToken",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

const ERC20_ABI = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "spender",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "approve",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "owner",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "spender",
        "type": "address"
      }
    ],
    "name": "allowance",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

interface TokenSwapperProps {
  onClose?: () => void;
  onTransactionSuccess?: () => Promise<void>;
}

interface TokenOption {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  confidentialSymbol: string;
  confidentialName: string;
  isDeployed: boolean;
}

export default function TokenSwapper({ onClose, onTransactionSuccess }: TokenSwapperProps) {
  const { address, isConnected } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const [fheInitialized, setFheInitialized] = useState(false);
  const [fheError, setFheError] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [selectedToken, setSelectedToken] = useState<string>(CONTRACTS.WETH);
  const [swapDirection, setSwapDirection] = useState<'wrap' | 'unwrap'>('wrap');
  const [showSuccess, setShowSuccess] = useState(false);
  const [balanceWarning, setBalanceWarning] = useState<string | null>(null);
  const [isValidAmount, setIsValidAmount] = useState(false);
  const [needsApproval, setNeedsApproval] = useState(false);
  const [tokenBalance, setTokenBalance] = useState<string>('0');

  // Available tokens
  const availableTokens: TokenOption[] = [
    {
      address: CONTRACTS.WETH,
      symbol: 'WETH',
      name: 'Wrapped Ether',
      decimals: 18,
      confidentialSymbol: 'cWETH',
      confidentialName: 'Confidential Wrapped Ether',
      isDeployed: String(CONTRACTS.CONFIDENTIAL_WETH) !== '0x0000000000000000000000000000000000000000'
    },
    {
      address: CONTRACTS.USDC,
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      confidentialSymbol: 'cUSDC',
      confidentialName: 'Confidential USD Coin',
      isDeployed: String(CONTRACTS.CONFIDENTIAL_USDC) !== '0x0000000000000000000000000000000000000000'
    }
  ];

  // Get balance for selected token
  const { data: balance } = useBalance({
    address,
    token: selectedToken as `0x${string}`,
  });

  // Initialize FHE on component mount
  useEffect(() => {
    const initializeFHE = async () => {
      if (!isConnected || !address) return;
      
      try {
        console.log('🔧 Initializing FHE for confidential operations...');
        const { getFHEInstance } = await import('../utils/fhe');
        await getFHEInstance();
        setFheInitialized(true);
        setFheError(null);
        console.log('✅ FHE initialized successfully');
      } catch (error) {
        console.error('❌ FHE initialization failed:', error);
        setFheError(error instanceof Error ? error.message : 'Failed to initialize FHE');
        setFheInitialized(false);
      }
    };

    initializeFHE();
  }, [isConnected, address]);

  // Update token balance
  useEffect(() => {
    if (balance) {
      setTokenBalance(balance.formatted);
    }
  }, [balance]);

  // Validate amount and check approval
  useEffect(() => {
    if (amount && selectedToken) {
      const amountWei = parseFloat(amount);
      const balanceWei = parseFloat(tokenBalance);
      const tokenInfo = availableTokens.find(t => t.address === selectedToken);
      
      if (!tokenInfo) return;

      if (swapDirection === 'wrap') {
        setIsValidAmount(amountWei > 0 && amountWei <= balanceWei);
        
        if (amountWei > 0 && amountWei > balanceWei) {
          setBalanceWarning(`Insufficient ${tokenInfo.symbol} balance. Available: ${formatBalance(tokenBalance)} ${tokenInfo.symbol}`);
        } else {
          setBalanceWarning(null);
        }

        // Check if approval is needed (for ERC20 tokens, not ETH)
        if (selectedToken !== CONTRACTS.WETH) {
          // TODO: Check allowance and set needsApproval
          setNeedsApproval(false); // Placeholder
        }
      } else {
        // For unwrap, we need FHE initialized and no errors
        setIsValidAmount(amountWei > 0 && fheInitialized && !fheError);
        setBalanceWarning(null); // Balance checking for confidential tokens is more complex
      }
    } else {
      setIsValidAmount(false);
      setBalanceWarning(null);
      setNeedsApproval(false);
    }
  }, [amount, selectedToken, tokenBalance, swapDirection, fheInitialized, fheError]);

  useEffect(() => {
    if (isSuccess) {
      setShowSuccess(true);
      setAmount('');
      setTimeout(() => setShowSuccess(false), 5000);
      
      if (onTransactionSuccess) {
        onTransactionSuccess();
      }
    }
  }, [isSuccess, onTransactionSuccess]);

  const handleMaxAmount = () => {
    if (swapDirection === 'wrap' && tokenBalance) {
      setAmount(tokenBalance);
    }
    // For unwrap, MAX functionality would require decrypted confidential balance
  };

  const handleSwap = async () => {
    if (!isValidAmount || !amount || !address) return;

    try {
      const tokenInfo = availableTokens.find(t => t.address === selectedToken);
      if (!tokenInfo) throw new Error('Invalid token selected');

      if (swapDirection === 'wrap') {
        console.log('📦 Starting wrap process...');
        
        // For ERC20 tokens, we need to approve first
        if (needsApproval) {
          // TODO: Handle approval
          console.log('Approval needed for', tokenInfo.symbol);
        }

        const amountWei = parseUnits(amount, tokenInfo.decimals);
        
        await writeContract({
          address: CONTRACTS.TOKEN_SWAPPER as `0x${string}`,
          abi: SWAPPER_ABI,
          functionName: 'swapERC20ToConfidential',
          args: [selectedToken as `0x${string}`, amountWei, address],
        });
      } else {
        console.log('📤 Starting unwrap process...');
        
        if (!fheInitialized) {
          throw new Error('FHE not initialized. Please wait for initialization to complete.');
        }
        
        if (fheError) {
          throw new Error(`FHE initialization failed: ${fheError}`);
        }

        // Import FHE utilities
        const { encryptAndRegister } = await import('../utils/fhe');
        
        const amountWei = parseUnits(amount, tokenInfo.decimals);
        console.log('🔐 Encrypting amount for unwrap:', amountWei.toString());
        
        // Get confidential token address
        const confidentialAddress = tokenInfo.address === CONTRACTS.WETH 
          ? CONTRACTS.CONFIDENTIAL_WETH 
          : CONTRACTS.CONFIDENTIAL_USDC;
        
        // Encrypt amount for unwrap
        const encryptedAmount = await encryptAndRegister(
          confidentialAddress,
          address,
          amountWei
        );
        
        if (!encryptedAmount || !encryptedAmount.handles?.length || !encryptedAmount.inputProof) {
          throw new Error('Failed to encrypt amount for unwrap. Please try again.');
        }
        
        console.log('📝 Calling unwrap with encrypted data...');
        
        await writeContract({
          address: CONTRACTS.TOKEN_SWAPPER as `0x${string}`,
          abi: SWAPPER_ABI,
          functionName: 'swapConfidentialToERC20',
          args: [
            confidentialAddress as `0x${string}`,
            encryptedAmount.handles[0] as `0x${string}`,
            encryptedAmount.inputProof as `0x${string}`
          ],
        });
      }
    } catch (err) {
      console.error('❌ Swap failed:', err);
    }
  };

  const formatBalance = (balance: string) => {
    return parseFloat(balance).toFixed(4);
  };

  const handleDirectionChange = (event: React.MouseEvent<HTMLElement>, newDirection: 'wrap' | 'unwrap' | null) => {
    if (newDirection !== null) {
      setSwapDirection(newDirection);
      setAmount('');
      setBalanceWarning(null);
    }
  };

  const handleTokenChange = (tokenAddress: string) => {
    setSelectedToken(tokenAddress);
    setAmount('');
    setBalanceWarning(null);
  };

  if (!isConnected) {
    return (
      <Alert severity="info">
        Please connect your wallet to swap between ERC20 and confidential tokens.
      </Alert>
    );
  }

  const selectedTokenInfo = availableTokens.find(t => t.address === selectedToken);

  return (
    <Box sx={{ maxWidth: 500, mx: 'auto' }}>
      {onClose && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Token Swapper</Typography>
          <IconButton onClick={onClose}>
            <Close />
          </IconButton>
        </Box>
      )}

      {showSuccess && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Successfully {swapDirection === 'wrap' ? 'converted' : 'unwrapped'} {amount} {selectedTokenInfo?.symbol} to {selectedTokenInfo?.confidentialSymbol}!
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {swapDirection === 'wrap' ? 'Conversion' : 'Unwrapping'} failed: {error.message}
        </Alert>
      )}

      {swapDirection === 'unwrap' && !fheInitialized && !fheError && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Initializing FHE for confidential operations...
        </Alert>
      )}

      {swapDirection === 'unwrap' && fheError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          FHE initialization failed: {fheError}
        </Alert>
      )}

      {balanceWarning && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {balanceWarning}
        </Alert>
      )}

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <SwapHoriz sx={{ mr: 1, color: 'primary.main' }} />
              <Typography variant="h6">
                Token Swapper
              </Typography>
            </Box>
            
            <ToggleButtonGroup
              value={swapDirection}
              exclusive
              onChange={handleDirectionChange}
              size="small"
              sx={{ ml: 2 }}
            >
              <ToggleButton value="wrap">
                <SwapVert sx={{ mr: 0.5 }} />
                Wrap
              </ToggleButton>
              <ToggleButton value="unwrap">
                <SwapVert sx={{ mr: 0.5, transform: 'rotate(180deg)' }} />
                Unwrap
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
          
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Select Token</InputLabel>
            <Select
              value={selectedToken}
              onChange={(e) => handleTokenChange(e.target.value)}
              label="Select Token"
            >
              {availableTokens.map((token) => (
                <MenuItem key={token.address} value={token.address}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <Box>
                      <Typography>{token.name} ({token.symbol})</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {token.confidentialName} ({token.confidentialSymbol})
                      </Typography>
                    </Box>
                    <Chip 
                      label={token.isDeployed ? 'Deployed' : 'Not Deployed'} 
                      size="small" 
                      color={token.isDeployed ? 'success' : 'default'}
                    />
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {swapDirection === 'wrap' 
              ? `Convert your ${selectedTokenInfo?.symbol} to confidential ${selectedTokenInfo?.confidentialSymbol} tokens. Your balance will be encrypted and private.`
              : `Convert your confidential ${selectedTokenInfo?.confidentialSymbol} tokens back to ${selectedTokenInfo?.symbol}. Your balance will be decrypted.`
            }
          </Typography>

          <Box sx={{ mb: 3 }}>
            <TextField
              fullWidth
              label={`Amount (${swapDirection === 'wrap' ? selectedTokenInfo?.symbol : selectedTokenInfo?.confidentialSymbol})`}
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              InputProps={{
                endAdornment: (
                  <Button
                    size="small"
                    onClick={handleMaxAmount}
                    disabled={
                      (swapDirection === 'wrap' && !tokenBalance) ||
                      (swapDirection === 'unwrap')
                    }
                    sx={{ ml: 1 }}
                  >
                    MAX
                  </Button>
                ),
              }}
              helperText={
                swapDirection === 'wrap' 
                  ? (tokenBalance ? `Available: ${formatBalance(tokenBalance)} ${selectedTokenInfo?.symbol}` : 'Loading balance...')
                  : 'Confidential balance will be checked during unwrap'
              }
            />
          </Box>

          <Divider sx={{ my: 2 }} />

          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Swap Summary
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2">
                {swapDirection === 'wrap' ? `${selectedTokenInfo?.symbol} Amount:` : `${selectedTokenInfo?.confidentialSymbol} Amount:`}
              </Typography>
              <Typography variant="body2">{amount || '0'} {swapDirection === 'wrap' ? selectedTokenInfo?.symbol : selectedTokenInfo?.confidentialSymbol}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2">
                {swapDirection === 'wrap' ? `${selectedTokenInfo?.confidentialSymbol} Amount:` : `${selectedTokenInfo?.symbol} Amount:`}
              </Typography>
              <Typography variant="body2">{amount || '0'} {swapDirection === 'wrap' ? selectedTokenInfo?.confidentialSymbol : selectedTokenInfo?.symbol}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2">Status:</Typography>
              <Chip
                label={swapDirection === 'wrap' ? 'Confidential' : 'Public'}
                size="small"
                color={swapDirection === 'wrap' ? 'primary' : 'secondary'}
                icon={<AccountBalance />}
              />
            </Box>
          </Box>

          <Button
            fullWidth
            variant="contained"
            size="large"
            onClick={handleSwap}
            disabled={!isValidAmount || isPending || isConfirming || !selectedTokenInfo?.isDeployed}
            startIcon={
              isPending || isConfirming ? (
                <CircularProgress size={20} />
              ) : (
                <SwapHoriz />
              )
            }
            sx={{ py: 1.5 }}
          >
            {isPending
              ? 'Confirming Transaction...'
              : isConfirming
              ? `${swapDirection === 'wrap' ? 'Converting' : 'Unwrapping'}...`
              : swapDirection === 'unwrap' && !fheInitialized
              ? 'Initializing FHE...'
              : swapDirection === 'unwrap' && fheError
              ? 'FHE Error - Cannot Unwrap'
              : !selectedTokenInfo?.isDeployed
              ? 'Contract Not Deployed'
              : `${swapDirection === 'wrap' ? `Convert ${selectedTokenInfo?.symbol} → ${selectedTokenInfo?.confidentialSymbol}` : `Convert ${selectedTokenInfo?.confidentialSymbol} → ${selectedTokenInfo?.symbol}`}`}
          </Button>

          {hash && (
            <Box sx={{ mt: 2, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Transaction Hash: {hash.slice(0, 10)}...{hash.slice(-8)}
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
