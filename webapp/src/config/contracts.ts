// Contract addresses for Sepolia network
export const CONTRACTS = {
  // Original ERC20 tokens on Sepolia
  WETH: '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9',
  USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  DAI: '0x75236711d42D0f7Ba91E03fdCe0C9377F5b76c07',
  
  // Confidential ERC7984 tokens (✨ DEPLOYMENT #6 - DECIMAL MIXING FIX)
  CONFIDENTIAL_WETH: '0xcA185E2f8eCC2c83Ea2B3A256e334b103293d705',  // 18 decimals ✅
  CONFIDENTIAL_USDC: '0x4CBBcaEbe5f295CEdB7B72F5c2e29593Bf034641',  // 6 decimals ✅
  CONFIDENTIAL_DAI: '0x7a7b8537497e232aBA0563FDEF9B90E4Dcd27aB5',   // 18 decimals ✅
  
  // Token Swapper (✨ DEPLOYMENT #6 - FINAL - with correct NEW token addresses)
  TOKEN_SWAPPER: '0xE2745acF4fDBA0227486B79bd3D2b5A71CF62AeD',
  
  // 🆕 MODULAR LENDING PROTOCOL (✨ DEPLOYMENT #12 - DEBT CONVERSION BUG FIXED!)
   LENDING_POOL: '0x6Aca601deF3779937600bE6d0605DB6C0b5d339C',
   POOL_CONFIGURATOR: '0x2B8b998279795CD3bC5A0d2f56EB015a76bA0b0b',
   PRICE_ORACLE: '0xf8C9eC291284f2D33A14D63bC540d7cE92C2B1F8',
   ACL_MANAGER: '0x1D5a6a01908ed2f35D7557723bB9a78Bf9c30039',
  
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