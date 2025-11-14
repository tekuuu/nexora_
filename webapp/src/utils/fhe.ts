'use client';

// Import polyfills first
import './polyfills';

export interface FhevmInstance {
  getPublicKey: () => { publicKeyId: string; publicKey: Uint8Array; } | null;
  getPublicParams: (bits: 1 | 8 | 16 | 32 | 64 | 128 | 160 | 256 | 512 | 1024 | 2048) => { publicParams: Uint8Array; publicParamsId: string; } | null;
  createEIP712: (
    publicKey: string,
    contractAddresses: string[],
    startTimestamp: number,
    durationDays: number
  ) => any;
  generateKeypair: () => { publicKey: string; privateKey: string };
  createEncryptedInput: (contractAddress: string, userAddress: string) => {
    add64: (value: bigint) => void;
    encrypt: () => Promise<{
      handles: string[];
      inputProof: string;
    }>;
  };
  publicDecrypt: (handles: (string | Uint8Array)[]) => Promise<Record<string, string | bigint | boolean>>;
  userDecrypt: (
    handles: Array<{ handle: string; contractAddress: string }>,
    privateKey: string,
    publicKey: string,
    signature: string,
    contractAddresses: string[],
    userAddress: string,
    startTimestamp: number,
    durationDays: number
  ) => Promise<Record<string, string | bigint | boolean>>;
}

let fheInstance: FhevmInstance | null = null;
// Use a single initialization promise to avoid races when multiple callers request the instance
let initPromise: Promise<FhevmInstance | null> | null = null;

// Public key storage for caching
const publicKeyStorage = new Map<string, { publicKey: string; publicParams: any }>();

// Load Zama Relayer SDK from CDN with a timeout and single primary URL
const SDK_URL = "https://cdn.zama.org/relayer-sdk-js/0.2.0/relayer-sdk-js.umd.cjs";
const SDK_LOAD_TIMEOUT_MS = Number(process.env.NEXT_PUBLIC_FHE_SDK_LOAD_TIMEOUT_MS) || 30000;
const INSTANCE_INIT_TIMEOUT_MS = Number(process.env.NEXT_PUBLIC_FHE_INSTANCE_INIT_TIMEOUT_MS) || 60000;
const ENABLE_FHE_DEBUG = process.env.NEXT_PUBLIC_FHE_DEBUG === 'true';

const dbg = (...args: any[]) => {
  if (ENABLE_FHE_DEBUG) console.log('[fhe]', ...args);
};

const withTimeout = <T>(p: Promise<T>, ms: number, msg?: string) => {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(msg || `Operation timed out after ${ms}ms`)), ms);
    p.then((v) => {
      clearTimeout(timer);
      resolve(v);
    }).catch((err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
};

// Load SDK (single URL). This intentionally avoids fallback mirrors to keep behavior deterministic.
const loadRelayerSDK = async (): Promise<void> => {
  if ((window as any).relayerSDK) return;

  return withTimeout(new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[data-relayer-sdk]`);
    if (existing) {
      // If a script tag exists but relayerSDK not ready yet, wait for load/onerror events
      if ((window as any).relayerSDK) return resolve();
      // remove stale, we'll inject a fresh one
      existing.parentElement?.removeChild(existing);
    }

    const script = document.createElement('script');
    script.src = SDK_URL;
    script.type = 'text/javascript';
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.dataset.relayerSdk = 'true';

    script.onload = () => {
      // The SDK should attach `relayerSDK` to window; ensure it did
      if (!(window as any).relayerSDK) {
        return reject(new Error('Relayer SDK loaded but global `relayerSDK` not present'));
      }
      resolve();
    };
    script.onerror = (ev) => {
      reject(new Error(`Failed to load Relayer SDK from ${SDK_URL}`));
    };

    dbg('Loading Zama Relayer SDK from CDN:', SDK_URL);
    document.head.appendChild(script);
  }), SDK_LOAD_TIMEOUT_MS, 'Loading Relayer SDK timed out');
};

export const getFHEInstance = async (provider?: any): Promise<FhevmInstance> => {
  // Only run in browser environment
  if (typeof window === 'undefined') {
    throw new Error('FHE operations can only be performed in the browser');
  }

  // If we already have a ready instance, return it immediately
  if (fheInstance) return fheInstance;

  // If initialization is already in progress, return the same promise
  if (initPromise) {
    const p = await initPromise;
    if (p) return p;
  }

  // Otherwise, create a single init promise that other callers can await
  initPromise = (async () => {
    try {
      dbg('Starting FHE instance initialization...');

      if (!(window as any).relayerSDK) {
        dbg('Relayer SDK not present, loading from CDN...');
        await loadRelayerSDK();
        dbg('Relayer SDK loaded');
      }

      const relayerSDK = (window as any).relayerSDK;
      if (!relayerSDK) throw new Error('relayerSDK not available after loading');

      // Initialize SDK if needed
      if (!relayerSDK.__initialized__) {
        dbg('Initializing relayerSDK...');
        await withTimeout(relayerSDK.initSDK(), INSTANCE_INIT_TIMEOUT_MS, 'relayerSDK.initSDK timed out');
        relayerSDK.__initialized__ = true;
      }

      const aclAddress = relayerSDK.SepoliaConfig?.aclContractAddress;
      const cachedKey = aclAddress ? publicKeyStorage.get(aclAddress) : undefined;

      const { getSepoliaRpcUrl } = await import('./rpc');
      const config = {
        ...relayerSDK.SepoliaConfig,
        network: provider || getSepoliaRpcUrl(),
        ...(cachedKey && { publicKey: cachedKey.publicKey, publicParams: cachedKey.publicParams }),
      };

      dbg('Creating relayerSDK instance with config', { aclAddress, cachedKey: !!cachedKey });

      // Create instance with a timeout
      fheInstance = await withTimeout(relayerSDK.createInstance(config), INSTANCE_INIT_TIMEOUT_MS, 'createInstance timed out');

      // Cache public key/params when available
      if (fheInstance && aclAddress) {
        const publicKeyData = fheInstance.getPublicKey?.();
        const publicParamsData = fheInstance.getPublicParams?.(2048 as any);
        if (publicKeyData && publicParamsData) {
          dbg('Caching public key and params');
          publicKeyStorage.set(aclAddress, {
            publicKey: publicKeyData.publicKeyId,
            publicParams: publicParamsData,
          });
        }
      }

      dbg('FHE instance ready');
      return fheInstance;
    } catch (err: any) {
      // On failure, clear initPromise so callers can attempt again later
      initPromise = null;
      dbg('FHE initialization failed:', err?.message || err);

        // Propagate error to callers so they can handle init failures explicitly.
        // Do not create or return a mock instance in any environment — rely on callers to
        // handle failures (show UI, retry, etc.).
        throw err;
    }
  })();

  const result = await initPromise;
  if (!result) throw new Error('FHE instance not available');
  return result;
};

// Cleanup function to dispose of FHE instance
export const cleanupFHEInstance = () => {
  fheInstance = null;
  initPromise = null;
};

// Force re-initialization for new contract addresses
export const reinitializeFHEForNewContracts = () => {
  console.log('Forcing FHEVM re-initialization for new contracts...');
  console.log('Current contract addresses will be handled by contract configuration system');
  
  fheInstance = null;
  initPromise = null;
  publicKeyStorage.clear();
  
  // Also clear any cached encryption data in localStorage
  if (typeof window !== 'undefined') {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('fhevm') || key.includes('encrypt') || key.includes('relayer'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log('Cleared localStorage encryption cache:', keysToRemove);
  }
};

// Create encrypted input buffer for contract interaction
export const createEncryptedInput = async (
  contractAddress: string,
  userAddress: string
) => {
  // Only run in browser environment
  if (typeof window === 'undefined') {
    throw new Error('FHE operations can only be performed in the browser');
  }

  const instance = await getFHEInstance();
  
  // Note: This method might not exist in the new SDK version
  // We'll need to check the actual API
  if ('createEncryptedInput' in instance) {
    return (instance as any).createEncryptedInput(contractAddress, userAddress);
  }
  
  throw new Error('createEncryptedInput method not available in current SDK version');
};

// Encrypt a value and register it to FHEVM with retry logic
export const encryptAndRegister = async (
  contractAddress: string,
  userAddress: string,
  value: bigint,
  maxRetries: number = 3
) => {
  // Only run in browser environment
  if (typeof window === 'undefined') {
    throw new Error('FHE operations can only be performed in the browser');
  }

  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔐 Creating encrypted input (attempt ${attempt}/${maxRetries}) for contract:`, contractAddress, 'user:', userAddress, 'value:', value.toString());
      
      const buffer = await createEncryptedInput(contractAddress, userAddress);
      console.log('📦 Encrypted input buffer created successfully');
      
      // Add the value to the buffer (using add64 for uint64 values)
      if ('add64' in buffer) {
        (buffer as any).add64(value);
        console.log('➕ Value added to buffer using add64');
      } else if ('add32' in buffer) {
        (buffer as any).add32(Number(value));
        console.log('➕ Value added to buffer using add32');
      } else {
        throw new Error('Buffer does not support add64 or add32 methods');
      }
      
      // Encrypt and register to FHEVM
      if ('encrypt' in buffer) {
        console.log('🔒 Encrypting buffer...');
        const ciphertexts = await (buffer as any).encrypt();
        console.log('✅ Encryption successful');
        return ciphertexts;
      }
      
      throw new Error('Buffer encrypt method not available');
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`❌ encryptAndRegister attempt ${attempt}/${maxRetries} failed:`, lastError.message);
      
      // If it's a relayer error, wait before retrying
      if (lastError.message.includes('Relayer') || lastError.message.includes('JSON')) {
        console.log(`⏳ Waiting 2 seconds before retry ${attempt + 1}...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      // If this is the last attempt, throw the error
      if (attempt === maxRetries) {
        throw new Error(`Failed to encrypt amount after ${maxRetries} attempts: ${lastError.message}`);
      }
    }
  }
  
  throw lastError || new Error('Encryption failed for unknown reason');
};

// Decrypt user data using the official Zama pattern
export const decryptUserData = async (
  encryptedData: string,
  userAddress: string,
  contractAddress: string,
  signer: any
) => {
  // Only run in browser environment
  if (typeof window === 'undefined') {
    return null; // Return null during SSR
  }

  try {
    const instance = await getFHEInstance();
    
    // Import the signature management
    const { FhevmDecryptionSignature } = await import('./FhevmDecryptionSignature');
    
    // Create or load decryption signature
    const sig = await FhevmDecryptionSignature.loadOrSign(
      instance as any,
      [contractAddress],
      signer
    );
    
    if (!sig) {
      console.error('Failed to create decryption signature');
      return null;
    }
    
    // Use userDecrypt method (official Zama pattern)
    const result = await instance.userDecrypt(
      [{ handle: encryptedData, contractAddress }],
      sig.privateKey,
      sig.publicKey,
      sig.signature,
      sig.contractAddresses,
      sig.userAddress,
      sig.startTimestamp,
      sig.durationDays
    );
    
    const decryptedValue = result[encryptedData];
    if (typeof decryptedValue === 'bigint') {
      return decryptedValue;
    } else if (typeof decryptedValue === 'string') {
      return BigInt(decryptedValue);
    } else {
      return BigInt(0);
    }
  } catch (error) {
    console.error('Decryption failed:', error);
    return null;
  }
};

// Helper function to format encrypted balance for display
export const formatEncryptedBalance = async (
  encryptedBalance: string,
  userAddress: string,
  contractAddress: string,
  signer: any
): Promise<string> => {
  // Only run in browser environment
  if (typeof window === 'undefined') {
    return 'Encrypted'; // Return default during SSR
  }

  try {
    const decryptedValue = await decryptUserData(encryptedBalance, userAddress, contractAddress, signer);
    
    if (decryptedValue !== null) {
      // Convert from wei to ETH and format
      const ethValue = Number(decryptedValue) / 1e18;
      return `${ethValue.toFixed(4)} ETH`;
    }
    return 'Encrypted';
  } catch (error) {
    console.error('Error formatting encrypted balance:', error);
    return 'Encrypted';
  }
};
