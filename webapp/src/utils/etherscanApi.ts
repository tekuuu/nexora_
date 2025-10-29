// Etherscan API integration for fetching ERC20 tokens on Sepolia
const ETHERSCAN_API_KEY = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY || 'EZHY9EJK8FSXXTH8XT2K5Y1UQ5322786QB';
const SEPOLIA_API_URL = 'https://api-sepolia.etherscan.io/api';

export interface EtherscanToken {
  contractAddress: string;
  name: string;
  symbol: string;
  decimals: string;
  balance?: string;
  logo?: string;
}

export interface EtherscanResponse {
  status: string;
  message: string;
  result: EtherscanToken[];
}

// Fetch list of ERC20 tokens on Sepolia
export const fetchSepoliaTokens = async (page: number = 1, offset: number = 100): Promise<EtherscanToken[]> => {
  try {
    const response = await fetch(
      `${SEPOLIA_API_URL}?module=token&action=getTokenList&page=${page}&offset=${offset}&apikey=${ETHERSCAN_API_KEY}`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data: EtherscanResponse = await response.json();
    
    if (data.status === '1') {
      return data.result;
    } else {
      console.warn('Etherscan API warning:', data.message);
      return [];
    }
  } catch (error) {
    console.error('Error fetching Sepolia tokens:', error);
    return [];
  }
};

// Fetch user's token balances for specific tokens using individual API calls
export const fetchTokenBalances = async (userAddress: string, tokenAddresses: string[]): Promise<{[address: string]: string}> => {
  const balances: {[address: string]: string} = {};
  
  if (!userAddress) {
    console.warn('No user address provided for balance fetching');
    return balances;
  }
  
  console.log('Fetching balances for:', { userAddress, tokenAddresses });
  
  try {
    // Use individual API calls for each token (more reliable)
    // Process tokens sequentially to avoid rate limiting
    for (let i = 0; i < tokenAddresses.length; i++) {
      const tokenAddress = tokenAddresses[i];
      
      try {
        const url = `${SEPOLIA_API_URL}?module=account&action=tokenbalance&contractaddress=${tokenAddress}&address=${userAddress}&tag=latest&apikey=${ETHERSCAN_API_KEY}`;
        console.log(`Fetching balance for ${tokenAddress} (${i + 1}/${tokenAddresses.length}):`, url);
        
        const response = await fetch(url);
        
        if (response.ok) {
          const data = await response.json();
          console.log(`Balance response for ${tokenAddress}:`, data);
          
          if (data.status === '1' && data.result !== undefined) {
            const balance = data.result.toString();
            balances[tokenAddress.toLowerCase()] = balance;
            console.log(`✅ Balance for ${tokenAddress}:`, balance);
          } else {
            console.warn(`Etherscan response NOTOK for ${tokenAddress}:`, data.message || 'Unknown error');
            balances[tokenAddress.toLowerCase()] = '0';
          }
        } else {
          console.error(`HTTP error for ${tokenAddress}:`, response.status, response.statusText);
          balances[tokenAddress.toLowerCase()] = '0';
        }
        
        // Add small delay between requests to avoid rate limiting
        if (i < tokenAddresses.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
      } catch (error) {
        console.error(`Error fetching balance for token ${tokenAddress}:`, error);
        balances[tokenAddress.toLowerCase()] = '0';
      }
    }
    
    // Ensure all requested tokens have a balance (even if 0)
    tokenAddresses.forEach(addr => {
      if (!balances[addr.toLowerCase()]) {
        balances[addr.toLowerCase()] = '0';
        console.log(`Setting default balance 0 for ${addr}`);
      }
    });
    
    console.log('Final balances:', balances);
    return balances;
  } catch (error) {
    console.error('Error fetching token balances:', error);
    return balances;
  }
};

// Get popular Sepolia testnet tokens (limited to 2 tokens to avoid API rate limits)
export const getPopularSepoliaTokens = (): EtherscanToken[] => {
  return [
    {
      contractAddress: '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9',
      name: 'Wrapped Ether',
      symbol: 'WETH',
      decimals: '18'
    },
    {
      contractAddress: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: '6'
    }
  ];
};

// Format token balance based on decimals
export const formatTokenBalance = (balance: string, decimals: string): string => {
  const balanceNum = parseFloat(balance);
  const decimalsNum = parseInt(decimals);
  
  if (balanceNum === 0) return '0';
  
  const formatted = balanceNum / Math.pow(10, decimalsNum);
  
  // Format with appropriate decimal places
  if (formatted >= 1) {
    return formatted.toFixed(4);
  } else if (formatted >= 0.01) {
    return formatted.toFixed(6);
  } else {
    return formatted.toExponential(4);
  }
};

// Check if token has balance
export const hasTokenBalance = (balance: string): boolean => {
  return balance !== '0' && balance !== undefined && balance !== null;
};

// Test function to verify Etherscan API is working
export const testEtherscanAPI = async (): Promise<boolean> => {
  try {
    const testAddress = '0x0000000000000000000000000000000000000000'; // Zero address for testing
    const testToken = '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9'; // WETH
    
    const url = `${SEPOLIA_API_URL}?module=account&action=tokenbalance&contractaddress=${testToken}&address=${testAddress}&tag=latest&apikey=${ETHERSCAN_API_KEY}`;
    
    console.log('Testing Etherscan API:', url);
    
    const response = await fetch(url);
    
    if (response.ok) {
      const data = await response.json();
      console.log('Etherscan API test response:', data);
      
      if (data.status === '1') {
        console.log('✅ Etherscan API is working correctly');
        return true;
      } else {
        console.warn('Etherscan API returned NOTOK:', data.message);
        return false;
      }
    } else {
      console.error('❌ Etherscan API HTTP error:', response.status, response.statusText);
      return false;
    }
  } catch (error) {
    console.error('❌ Etherscan API test failed:', error);
    return false;
  }
};

// Test balance fetching for a specific token and address
export const testTokenBalance = async (userAddress: string, tokenAddress: string): Promise<string> => {
  try {
    const url = `${SEPOLIA_API_URL}?module=account&action=tokenbalance&contractaddress=${tokenAddress}&address=${userAddress}&tag=latest&apikey=${ETHERSCAN_API_KEY}`;
    
    console.log(`Testing balance for ${tokenAddress}:`, url);
    
    const response = await fetch(url);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`Test balance response for ${tokenAddress}:`, data);
      
      if (data.status === '1' && data.result !== undefined) {
        const balance = data.result.toString();
        console.log(`✅ Test balance for ${tokenAddress}:`, balance);
        return balance;
      } else {
        console.error(`❌ Test failed for ${tokenAddress}:`, data.message || 'Unknown error');
        return '0';
      }
    } else {
      console.error(`❌ Test HTTP error for ${tokenAddress}:`, response.status, response.statusText);
      return '0';
    }
  } catch (error) {
    console.error(`❌ Test failed for ${tokenAddress}:`, error);
    return '0';
  }
};

