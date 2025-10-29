# Manual Deployment Instructions for TokenSwapperV2

Due to RPC connectivity issues, here are alternative deployment methods:

## Option 1: Update Infura API Key (RECOMMENDED)

1. Go to https://infura.io
2. Sign in or create a free account
3. Create a new project (or use existing one)
4. Copy the Project ID
5. Update `.env` file:
   ```bash
   INFURA_API_KEY="YOUR_NEW_PROJECT_ID"
   ```
6. Run deployment:
   ```bash
   cd /home/zoe/nexora
   npx hardhat deploy --tags swapper-v2-simple --network sepolia
   ```

## Option 2: Deploy via Remix IDE (EASIEST)

1. Go to https://remix.ethereum.org
2. Create a new file: `ConfidentialTokenSwapperV2.sol`
3. Copy the contract code from `/contracts/ConfidentialTokenSwapperV2.sol`
4. Compile the contract (Solidity 0.8.24)
5. Deploy:
   - Environment: "Injected Provider - MetaMask"
   - Network: Switch MetaMask to Sepolia
   - Constructor argument: Your wallet address (owner)
   - Click "Deploy"
6. After deployment, call these functions:
   ```
   addTokenPair(
     "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9",  // WETH
     "0x42207db383425dFB0bEa35864d8d17E7D99f78E3"   // cWETH
   )
   
   addTokenPair(
     "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",  // USDC
     "0x3852002C2ae45D8AAf1CE01AD74FCA1836bb78B0"   // cUSDC
   )
   ```
7. Copy the deployed contract address
8. Update `/webapp/src/config/contracts.ts`:
   ```typescript
   TOKEN_SWAPPER: 'YOUR_DEPLOYED_ADDRESS',
   ```

## Option 3: Use Alchemy RPC (Alternative to Infura)

1. Go to https://www.alchemy.com
2. Sign up for free account
3. Create a new app on Sepolia testnet
4. Copy the HTTPS endpoint
5. Update `hardhat.config.ts`:
   ```typescript
   sepolia: {
     accounts: [PRIVATE_KEY],
     chainId: 11155111,
     url: "YOUR_ALCHEMY_HTTPS_ENDPOINT",
   },
   ```
6. Run deployment

## After Deployment

1. **Save the contract address** to:
   - `/webapp/src/config/contracts.ts`
   - `.env` file as `TOKEN_SWAPPER_V2_ADDRESS=0x...`

2. **Recover stuck tokens** from old contract (if any):
   - Check old swapper contract: `0x7c260Bf038282c5dcD5b61499d40DBA616eB416b`
   - Call `emergencyWithdraw` if you're the owner
   - Or contact the contract owner

3. **Update frontend** to use new contract address

4. **Test manual finalization** feature

## Current Contract Addresses

- **Old TokenSwapper**: `0x7c260Bf038282c5dcD5b61499d40DBA616eB416b`
- **cWETH**: `0x42207db383425dFB0bEa35864d8d17E7D99f78E3`
- **cUSDC**: `0x3852002C2ae45D8AAf1CE01AD74FCA1836bb78B0`
- **WETH**: `0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9`
- **USDC**: `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`

## Need Help?

If you continue to have issues:
1. Check that you have Sepolia ETH for gas
2. Verify your wallet has enough balance
3. Try using MetaMask with Remix (easiest option)
4. Contact support if issues persist




