# 🔧 CORS Error Fix Instructions

## **Problem**
You're seeing this error:
```
Access to fetch at 'https://relayer.testnet.zama.cloud/v1/user-decrypt' from origin 'http://localhost:3000' 
has been blocked by CORS policy
```

But your dev server is running on **port 3002**, not 3000!

---

## **Why This Happens**
1. Browser cached the old port (3000)
2. Service Worker registered on old port
3. Old browser tabs still open

---

## **Solution: Clear Everything and Restart**

### **Step 1: Clear Browser Cache**
1. Open your browser DevTools (F12)
2. **Right-click the Refresh button** (while DevTools is open)
3. Select **"Empty Cache and Hard Reload"**

### **Step 2: Clear Service Workers**
1. In DevTools, go to **Application** tab
2. Go to **Service Workers** section
3. Click **"Unregister"** for all service workers
4. Go to **Cache Storage** section
5. **Delete all caches**

### **Step 3: Clear LocalStorage**
1. In DevTools, go to **Application** > **Local Storage**
2. Select **`http://localhost:3000`** (if it exists)
3. **Right-click > Clear**
4. Select **`http://localhost:3002`** (if it exists)
5. **Right-click > Clear**

### **Step 4: Close ALL Browser Tabs**
- Close **ALL tabs** for `localhost:3000` and `localhost:3002`
- Close the browser completely (Cmd/Ctrl+Q or File > Exit)

### **Step 5: Restart Dev Server**
```bash
# Kill the old dev server
pkill -f "next dev"

# Start fresh
cd /home/zoe/nexora/webapp
npm run dev
```

### **Step 6: Open Fresh Browser Tab**
1. Open a **new private/incognito window** (Cmd/Ctrl+Shift+N)
2. Go to **`http://localhost:3002`** (check the port!)
3. Test the app

---

## **Quick Test**
If the CORS error is gone, you should see:
- ✅ Master signature creates successfully
- ✅ Confidential balances decrypt automatically
- ✅ No more CORS errors in console

---

## **Rate Limiting Fix (Already Applied)**
I've also fixed the Infura rate limiting issue by:
- ✅ Consolidating 3 auto-decryption effects into 1
- ✅ Adding debounce delays to prevent spam
- ✅ Removing aggressive retry loops from Dashboard

---

## **If CORS Error Persists**
This might be a Zama relayer issue. Try:
1. Wait 5-10 minutes for rate limits to reset
2. Check Zama status: https://status.zama.ai
3. Contact Zama support if the relayer is down

---

**After Following These Steps**, the app should work perfectly! 🎉



