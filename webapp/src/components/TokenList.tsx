'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
  Tooltip,
  Collapse,
  Divider,
  Stack,
} from '@mui/material';
import {
  ExpandMore,
  ExpandLess,
  AccountBalanceWallet,
  Refresh,
  SwapHoriz,
} from '@mui/icons-material';
import { 
  EtherscanToken, 
  fetchSepoliaTokens, 
  fetchTokenBalances, 
  getPopularSepoliaTokens,
  formatTokenBalance,
  hasTokenBalance,
  testEtherscanAPI,
  testTokenBalance
} from '../utils/etherscanApi';
import { CONTRACTS, TOKEN_INFO } from '../config/contracts';

interface TokenListProps {
  onTokenSelect?: (token: EtherscanToken) => void;
  showBalances?: boolean;
  maxTokens?: number;
  onSwapToken?: (token: EtherscanToken) => void;
}

export default function TokenList({ 
  onTokenSelect, 
  showBalances = true, 
  maxTokens = 50,
  onSwapToken
}: TokenListProps) {
  const { address } = useAccount();
  const [tokens, setTokens] = useState<EtherscanToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [tokenBalances, setTokenBalances] = useState<{[address: string]: string}>({});
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    // Load tokens immediately; Etherscan availability is non-fatal
    (async () => {
      try {
        const apiWorking = await testEtherscanAPI();
        if (!apiWorking) {
          setError(null); // don't surface as error, just fallback
        }
      } catch {}
      loadTokens();
    })();
  }, []);

  useEffect(() => {
    if (address && showBalances && tokens.length > 0) {
      loadTokenBalances();
    }
  }, [address, tokens, showBalances]);

  const loadTokens = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Use only the 5 selected tokens to avoid API rate limits
      const selectedTokens = getPopularSepoliaTokens();
      setTokens(selectedTokens);
      
      console.log('Loaded selected tokens:', selectedTokens.map(t => `${t.symbol} (${t.contractAddress})`));
    } catch (err) {
      console.error('Error loading tokens:', err);
      setError('Failed to load tokens');
      // Fallback to popular tokens only
      setTokens(getPopularSepoliaTokens());
    } finally {
      setLoading(false);
    }
  };

  const loadTokenBalances = async () => {
    if (!address) return;
    
    try {
      const tokenAddresses = tokens.map(t => t.contractAddress);
      const balances = await fetchTokenBalances(address, tokenAddresses);
      setTokenBalances(balances);
    } catch (err) {
      console.error('Error loading token balances:', err);
    }
  };

  const handleTokenClick = (token: EtherscanToken) => {
    if (onTokenSelect) {
      onTokenSelect(token);
    }
  };

  const handleSwapClick = (token: EtherscanToken, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent card click
    if (onSwapToken) {
      onSwapToken(token);
    }
  };

  const handleRefreshBalances = async () => {
    if (!address) return;
    
    setRefreshing(true);
    try {
      await loadTokenBalances();
    } finally {
      setRefreshing(false);
    }
  };

  const getTokenBalance = (tokenAddress: string): string => {
    // Handle case-insensitive address matching
    const lowerAddress = tokenAddress.toLowerCase();
    const balance = tokenBalances[lowerAddress] || tokenBalances[tokenAddress];
    if (!balance) return '0';
    return balance;
  };

  const tokensWithBalances = tokens.filter(token => {
    if (!showBalances) return true;
    const balance = getTokenBalance(token.contractAddress);
    return hasTokenBalance(balance);
  });

  const displayedTokens = expanded ? tokens : tokensWithBalances.slice(0, 6);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
        <CircularProgress size={24} sx={{ mr: 2 }} />
        <Typography variant="body2">Loading Sepolia tokens...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="warning" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Token Swap Interface
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title="Refresh balances">
            <span>
              <IconButton
                onClick={handleRefreshBalances}
                disabled={refreshing || !address}
                size="small"
                sx={{ mr: 1 }}
              >
                {refreshing ? <CircularProgress size={16} /> : <Refresh />}
              </IconButton>
            </span>
          </Tooltip>
          <Chip 
            label={`${tokens.length} tokens`} 
            size="small" 
            variant="outlined"
            color="primary"
          />
        </Box>
      </Box>

      {/* ERC20 Tokens Only - Confidential tokens moved to Portfolio tab */}
      <Box>
        <Box sx={{ mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
            ERC20 Tokens
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Your token balances - Swap to confidential versions for privacy
          </Typography>
        </Box>
          
          <Stack spacing={2}>
            {tokens.map((token) => {
              const balance = getTokenBalance(token.contractAddress);
              const hasBalance = hasTokenBalance(balance);
              const formattedBalance = formatTokenBalance(balance, token.decimals);

              return (
                <Card 
                  key={token.contractAddress}
                  sx={{ 
                    cursor: onTokenSelect ? 'pointer' : 'default',
                    transition: 'all 0.2s ease',
                    '&:hover': onTokenSelect ? {
                      transform: 'translateY(-2px)',
                      boxShadow: 2
                    } : {},
                    opacity: showBalances && !hasBalance ? 0.6 : 1
                  }}
                  onClick={() => handleTokenClick(token)}
                >
                  <CardContent sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <AccountBalanceWallet sx={{ mr: 1, fontSize: 20, color: 'primary.main' }} />
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                          {token.symbol}
                        </Typography>
                      </Box>
                      <SwapHoriz sx={{ color: 'text.secondary' }} />
                    </Box>
                    
                    <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
                      {token.name}
                    </Typography>
                    
                    <Typography variant="caption" sx={{ 
                      display: 'block', 
                      fontFamily: 'monospace',
                      color: 'text.secondary',
                      mb: 1
                    }}>
                      {token.contractAddress.slice(0, 6)}...{token.contractAddress.slice(-4)}
                    </Typography>

                    {showBalances && address && (
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          Balance: {formattedBalance} {token.symbol}
                        </Typography>
                        {hasBalance && (
                          <Chip 
                            label="Has Balance" 
                            size="small" 
                            color="success" 
                            sx={{ mt: 0.5 }}
                          />
                        )}
                      </Box>
                    )}

                    {(onTokenSelect || onSwapToken) && (
                      <Tooltip title={onSwapToken ? "Click to open swapper" : "Click to wrap to confidential"}>
                        <Typography 
                          variant="caption" 
                          sx={{ 
                            color: 'primary.main', 
                            cursor: 'pointer',
                            '&:hover': { textDecoration: 'underline' }
                          }}
                          onClick={onSwapToken ? (e) => handleSwapClick(token, e) : undefined}
                        >
                          {onSwapToken ? "Open Swapper →" : "Wrap to Confidential →"}
                        </Typography>
                      </Tooltip>
                    )}
                  </CardContent>
                </Card>
              );
            })}
        </Stack>
      </Box>
    </Box>
  );
}

