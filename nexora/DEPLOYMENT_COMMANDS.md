# 🚀 Deployment Commands Reference

**Last Updated**: October 11, 2025

---

## ✅ **Current Active Contract**

**Fixed TokenSwapper**: `0x89F91B61E038a1B894252dd5A63dCFCa9622d103`  
**Etherscan**: https://sepolia.etherscan.io/address/0x89F91B61E038a1B894252dd5A63dCFCa9622d103

---

## 📝 **Deploy New TokenSwapper Contract**

### **Standard Deployment:**
```bash
cd /home/zoe/nexora
npx hardhat deploy --tags swapper --network sepolia
```

### **Force Redeploy (Clear Cache):**
```bash
cd /home/zoe/nexora
rm -rf deployments/sepolia/ConfidentialTokenSwapper.json deployments/sepolia/.pending*
npx hardhat deploy --tags swapper --network sepolia --reset
```

### **With Higher Gas (If Stuck):**
```bash
cd /home/zoe/nexora
rm -rf deployments/sepolia/.pending*
npx hardhat deploy --tags swapper --network sepolia --gasprice 10000000000
```

---

## 📂 **Deployment Scripts**

### **Active Scripts:**

| Script | Purpose | Command |
|--------|---------|---------|
| `06_deploy_fixed_swapper.ts` | Deploy TokenSwapper | `--tags swapper` |
| `02_deploy_confidential_tokens.ts` | Deploy cWETH/cUSDC | Manual script |
| `01_deploy_confidential_lending.ts` | Deploy Vault (future) | `--tags lending-vault` |

---

## 🔧 **After Deployment:**

### **1. Update Frontend Config:**
```typescript
// Edit: webapp/src/config/contracts.ts
TOKEN_SWAPPER: '0xNEW_ADDRESS_HERE',
```

### **2. Update .env:**
```bash
# Add to .env file
TOKEN_SWAPPER_LATEST=0xNEW_ADDRESS_HERE
```

### **3. Restart Dev Server:**
```bash
cd /home/zoe/nexora/webapp
npm run dev
```

### **4. Clear Browser Cache:**
- Hard refresh: Ctrl+Shift+R
- Or clear cache in DevTools

---

## ⚠️ **Common Deployment Issues**

### **Issue 1: "replacement transaction underpriced"**
**Cause**: Stuck transaction with low gas  
**Fix**: Wait 15 minutes OR increase gas price with `--gasprice 10000000000`

### **Issue 2: "insufficient funds"**
**Cause**: Not enough Sepolia ETH  
**Fix**: Get more ETH from faucet (https://sepoliafaucet.com/)

### **Issue 3: "invalid project id"**
**Cause**: Infura API key invalid or expired  
**Fix**: Update `INFURA_API_KEY` in `.env` file

### **Issue 4: "ETIMEDOUT"**
**Cause**: Network connectivity issues  
**Fix**: Check internet connection, try different RPC

---

## 🎯 **Quick Deploy & Update:**

```bash
# Full workflow in one go:
cd /home/zoe/nexora

# Deploy
npx hardhat deploy --tags swapper --network sepolia

# Get the new address (it will be printed)
# Then update config:
# TOKEN_SWAPPER: '0xNEW_ADDRESS',

# Restart frontend
cd webapp && npm run dev
```

---

**That's it! Simple deployment process.** 🚀


