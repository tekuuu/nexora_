# 🔐 MASTER SIGNATURE UPDATE REQUIRED

## ⚠️ ACTION REQUIRED

You must **regenerate the master signature** to include the new Pool address!

---

## 📝 CONTRACT ADDRESSES FOR MASTER SIGNATURE

Update your signature generation to include these addresses:

```typescript
const CONTRACT_ADDRESSES = [
  // Confidential Tokens
  '0x42207db383425dFB0bEa35864d8d17E7D99f78E3', // cWETH
  '0x3852002C2ae45D8AAf1CE01AD74FCA1836bb78B0', // cUSDC
  
  // Token Swapper
  '0x5615e5f7f8E1CD9133884298b096082F4CfFed75', // ConfidentialTokenSwapper
  
  // 🆕 NEW: Lending Pool (MUST ADD THIS!)
  '0x6971d89049C5A27a854fD819CB6B88B5B20DCdEA', // ConfidentialLendingPool
];
```

---

## 🔍 WHY THIS IS NEEDED

**FHEVM requires master signatures for FHE permissions.**

When you:
- Supply to Pool
- Borrow from Pool
- Repay to Pool
- Withdraw from Pool

The **Pool contract needs permission** to read your encrypted balances to:
- Validate you have sufficient funds
- Update your positions
- Transfer confidential tokens

Without the Pool in your master signature, **ALL Pool operations will fail**!

---

## ✅ WHERE TO UPDATE

### 1. In Your Frontend Code

Look for where you generate the master signature (probably in a hook or auth flow):

**Before:**
```typescript
const addresses = [
  CONTRACTS.CONFIDENTIAL_WETH,
  CONTRACTS.CONFIDENTIAL_USDC,
  CONTRACTS.TOKEN_SWAPPER,
];
```

**After:**
```typescript
const addresses = [
  CONTRACTS.CONFIDENTIAL_WETH,
  CONTRACTS.CONFIDENTIAL_USDC,
  CONTRACTS.TOKEN_SWAPPER,
  CONTRACTS.LENDING_POOL, // 🆕 ADD THIS!
];
```

### 2. Regenerate Signature

After adding the Pool address, you need to:

1. **Clear old signature** (if stored)
2. **Reconnect wallet** or trigger re-signature
3. **Sign new message** with all 4 contract addresses
4. **Store new signature** for future use

---

## 🧪 HOW TO TEST

### Test 1: Check Signature Includes Pool
```typescript
// Verify your signature includes the Pool
const isPoolAuthorized = await checkPermission(
  userAddress,
  CONTRACTS.LENDING_POOL,
  masterSignature
);
console.log('Pool authorized:', isPoolAuthorized); // Should be true
```

### Test 2: Try Supply Operation
```typescript
// This should work if signature is correct
await pool.supply(
  CONTRACTS.CONFIDENTIAL_WETH,
  encryptedAmount,
  inputProof
);
```

**If signature is wrong:**
- ❌ Transaction will revert
- ❌ Error: "Unauthorized" or similar
- ❌ Pool can't read your balances

**If signature is correct:**
- ✅ Transaction succeeds
- ✅ Your balance updates
- ✅ Pool can read/write your encrypted data

---

## 🚨 COMMON ISSUES

### Issue 1: "Unauthorized" Error
**Cause:** Pool not in master signature  
**Fix:** Add Pool address and regenerate signature

### Issue 2: Old Signature Cached
**Cause:** Browser/app using old signature  
**Fix:** Clear cache, disconnect wallet, reconnect

### Issue 3: Wrong Address Used
**Cause:** Using old Pool address or typo  
**Fix:** Double-check address matches deployment:
```
LENDING_POOL: 0x6971d89049C5A27a854fD819CB6B88B5B20DCdEA
```

---

## 📋 CHECKLIST

Before testing Pool features:

- [ ] Pool address added to signature contract list
- [ ] Old signature cleared (if cached)
- [ ] Wallet reconnected
- [ ] New signature generated
- [ ] New signature includes Pool address (verified)
- [ ] Test supply operation
- [ ] Test withdraw operation
- [ ] Test borrow operation (once UI is ready)
- [ ] Test repay operation (once UI is ready)

---

## 💡 QUICK REFERENCE

**All Addresses You Need:**

```typescript
// Copy-paste ready format
export const SIGNATURE_CONTRACTS = {
  CWETH: '0x42207db383425dFB0bEa35864d8d17E7D99f78E3',
  CUSDC: '0x3852002C2ae45D8AAf1CE01AD74FCA1836bb78B0',
  SWAPPER: '0x5615e5f7f8E1CD9133884298b096082F4CfFed75',
  POOL: '0x6971d89049C5A27a854fD819CB6B88B5B20DCdEA', // 🆕 NEW!
} as const;

export const SIGNATURE_ADDRESS_ARRAY = [
  SIGNATURE_CONTRACTS.CWETH,
  SIGNATURE_CONTRACTS.CUSDC,
  SIGNATURE_CONTRACTS.SWAPPER,
  SIGNATURE_CONTRACTS.POOL,
];
```

---

## 🎯 EXPECTED BEHAVIOR

### After Correct Signature:

**Supply Flow:**
```
1. User signs encrypted amount
2. User calls pool.supply()
3. Pool reads user's balance (✅ authorized via master signature)
4. Pool validates balance
5. Pool transfers tokens
6. Pool updates balances
7. Pool grants new permissions
8. ✅ Success!
```

**Without Correct Signature:**
```
1. User signs encrypted amount
2. User calls pool.supply()
3. Pool tries to read user's balance
4. ❌ UNAUTHORIZED - signature doesn't include Pool
5. ❌ Transaction reverts
```

---

## 🔧 IMPLEMENTATION EXAMPLE

```typescript
// Example: Update signature generation hook

import { CONTRACTS } from '@/config/contracts';

export function useMasterSignature() {
  const generateSignature = async () => {
    const addresses = [
      CONTRACTS.CONFIDENTIAL_WETH,
      CONTRACTS.CONFIDENTIAL_USDC,
      CONTRACTS.TOKEN_SWAPPER,
      CONTRACTS.LENDING_POOL, // 🆕 ADDED!
    ];
    
    // Generate signature with all addresses
    const signature = await createMasterSignature(addresses);
    
    // Store for future use
    storeMasterSignature(signature);
    
    return signature;
  };
  
  return { generateSignature };
}
```

---

## ✅ VERIFICATION

**To verify signature is correct:**

1. Check browser console for signature addresses
2. Verify Pool address (`0x6971...`) is in the list
3. Try a supply operation
4. If it succeeds, signature is correct!

**Quick Test:**
```typescript
// Should NOT revert if signature is correct
await pool.supply(
  cWETH,
  encryptedAmount,
  inputProof
);
```

---

**Remember:** This is a **one-time setup** needed whenever you add new contracts that need FHE permissions!

**Status:** ⚠️ **ACTION REQUIRED BEFORE TESTING POOL FEATURES**

