// Contract addresses for Sepolia network
export const CONTRACTS = {
  // Original ERC20 tokens on Sepolia
  WETH: '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9',
  USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  DAI: '0x75236711d42D0f7Ba91E03fdCe0C9377F5b76c07',
  
  // Confidential ERC7984 tokens (✨ DEPLOYMENT #6 - DECIMAL MIXING FIX)
  CONFIDENTIAL_WETH: '0x4166b48d16e0DC31B10D7A1247ACd09f01632cBC',
  CONFIDENTIAL_USDC: '0xc323ccD9FcD6AfC3a0D568E4a6E522c41aEE04C4',
  CONFIDENTIAL_DAI: '0xd57a787BfDb9C86c0B1E0B5b7a316f8513F2E0D1',

  
  // Token Swapper (✨ DEPLOYMENT #6 - FINAL - with correct NEW token addresses)
  TOKEN_SWAPPER: '0xD662eC4370081be9d7Fca9599ad3E8f60235e7d9',
  
  // 🆕 MODULAR LENDING PROTOCOL (✨ DEPLOYMENT #12 - DEBT CONVERSION BUG FIXED!)


   LENDING_POOL: '0x3945b869813189f9d220F9b80478AA5eEd5415E6',
   POOL_CONFIGURATOR: '0x7260Ccb6B968334042F5ED37E46bD53D0e1D5bfC',
   PRICE_ORACLE: '0x92e15f6898453196c20B055CeC21A5BFAf03e131',
   ACL_MANAGER: '0x9F1105E7bf5DCfd211f3Ae62d818B4fabeA6F9a3',


  
  // Libraries (for reference)
  SUPPLY_LOGIC: '0x194A6574816dD85564B229Eb46d10188FcB099c5',
  BORROW_LOGIC: '0x3901A05A82909C14cd7820a0Ee3c31ebE8395cFa',
  
  // 📝 OLD: Simple Vault (kept for reference, migrating to LENDING_POOL)
  // VAULT_ADDRESS: '0x5A8E9f71BDA27F04a18364604C8e55e472c7e6F4', // Deprecated
} as const;

// Token metadata
export const TOKEN_INFO = {
  [CONTRACTS.WETH]: {
    name: 'Wrapped Ether',
    symbol: 'WETH',
    decimals: 18,
    confidentialSymbol: 'cWETH',
    confidentialName: 'Confidential Wrapped Ether'
  },
  [CONTRACTS.USDC]: {
    name: 'USD Coin',
    symbol: 'USDC',
    decimals: 6,
    confidentialSymbol: 'cUSDC',
    confidentialName: 'Confidential USD Coin'
  },
  [CONTRACTS.DAI]: {
    name: 'DAI Stablecoin',
    symbol: 'DAI',
    decimals: 18,
    confidentialSymbol: 'cDAI',
    confidentialName: 'Confidential DAI'
  }
} as const;

// Network configuration
export const NETWORK_CONFIG = {
  chainId: 11155111, // Sepolia
  name: 'Sepolia',
  rpcUrl: 'https://sepolia.infura.io/v3/06f71af0371e488499064e57e093ed99',
  explorerUrl: 'https://sepolia.etherscan.io'
} as const;