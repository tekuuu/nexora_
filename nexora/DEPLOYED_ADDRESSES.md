# Deployed Contract Addresses - Sepolia Testnet

**Deployment Date**: October 10, 2025  
**Network**: Sepolia (Chain ID: 11155111)  
**Deployer**: 0xcC5C64e2Ff52d9b2D95B5dc9d4B1e9Edf232693B

---

## 🆕 **Latest Contracts (V2 - With Manual Finalization)**

### TokenSwapper V2
- **Address**: `0x984037Af24F941B4a364ebD7F68Ad7a7967F5e44`
- **Features**:
  - ✅ Manual finalization after 5 minutes
  - ✅ Emergency recovery for stuck tokens
  - ✅ Double-processing prevention
- **Etherscan**: https://sepolia.etherscan.io/address/0x984037Af24F941B4a364ebD7F68Ad7a7967F5e44

---

## 📦 **Confidential Tokens (ERC7984)**

### cWETH (Confidential Wrapped Ether)
- **Address**: `0x42207db383425dFB0bEa35864d8d17E7D99f78E3`
- **Symbol**: cWETH
- **Decimals**: 18
- **Etherscan**: https://sepolia.etherscan.io/address/0x42207db383425dFB0bEa35864d8d17E7D99f78E3

### cUSDC (Confidential USD Coin)
- **Address**: `0x3852002C2ae45D8AAf1CE01AD74FCA1836bb78B0`
- **Symbol**: cUSDC
- **Decimals**: 6
- **Etherscan**: https://sepolia.etherscan.io/address/0x3852002C2ae45D8AAf1CE01AD74FCA1836bb78B0

---

## 💰 **ERC20 Tokens (Sepolia Testnet)**

### WETH (Wrapped Ether)
- **Address**: `0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9`
- **Symbol**: WETH
- **Decimals**: 18

### USDC (USD Coin)
- **Address**: `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`
- **Symbol**: USDC
- **Decimals**: 6

---

## 🔙 **Previous Contracts (V1 - Deprecated)**

### ⚠️ TokenSwapper V1 (OLD - DO NOT USE)
- **Address**: `0x7c260Bf038282c5dcD5b61499d40DBA616eB416b`
- **Issue**: FHEVM Gateway doesn't call finalizeSwap callback
- **Status**: Deprecated - may contain stuck tokens
- **Recovery**: Use emergency withdrawal if you're the owner

---

## 🔄 **Token Pairs Configuration**

TokenSwapper V2 supports the following pairs:

| ERC20 Token | Confidential Token | Status |
|-------------|-------------------|--------|
| WETH (`0x7b79...98E7f9`) | cWETH (`0x4220...99f78E3`) | ✅ Active |
| USDC (`0x1c7D...379C7238`) | cUSDC (`0x3852...36bb78B0`) | ✅ Active |

---

## 📝 **Important Notes**

### For Users:
1. **Always use TokenSwapper V2** (`0x984037...`)
2. **If a swap fails**: Wait 5 minutes, then call `manuallyFinalizeSwap`
3. **Check transaction status**: https://sepolia.etherscan.io

### For Developers:
1. Update `webapp/src/config/contracts.ts` with V2 address
2. Add manual finalization UI to Dashboard
3. Monitor for stuck swaps and help users recover

### Recovery from V1:
If you have tokens stuck in V1 swapper:
1. Contact the contract owner for emergency withdrawal
2. Or wait for owner to implement recovery mechanism

---

## 🔗 **Useful Links**

- **Sepolia Faucet**: https://sepoliafaucet.com/
- **Etherscan**: https://sepolia.etherscan.io
- **Infura RPC**: https://sepolia.infura.io/v3/YOUR_PROJECT_ID
- **FHEVM Docs**: https://docs.zama.ai/fhevm

---

**Last Updated**: 2025-10-10  
**Status**: ✅ Deployed and Active




