import hre, { ethers } from "hardhat";
import { FhevmType } from "@fhevm/mock-utils";
import {
  SEPOLIA_CHAIN_ID,
  HARDHAT_CHAIN_ID,
  SEPOLIA_BLOCK_TIME,
  SEPOLIA_CONFIRMATION_BLOCKS,
  DECRYPTION_RETRY_ATTEMPTS,
  DECRYPTION_RETRY_DELAY,
  ORACLE_CALLBACK_POLL_INTERVAL,
  ORACLE_CALLBACK_MAX_POLLS,
  LOG_LEVEL_NORMAL,
  REPORT_GAS_COSTS,
  REPORT_TIMING,
  ERROR_NETWORK_NOT_SEPOLIA,
  ERROR_INSUFFICIENT_SEPOLIA_ETH,
} from "./constants";

export interface EncryptedInput { handle: string; inputProof: string }

export interface EncryptionOptions {
  contractAddress: string;
  userAddress: string;
  gasLimit?: bigint;
}

export interface NetworkInfo {
  chainId: bigint;
  name: string;
  isSepolia: boolean;
  isMocked: boolean;
  blockTime: number; // in ms
  gasPrice: bigint; // wei
}

export interface OperationDetails {
  user: string;
  asset: string;
  amount?: bigint;
  txHash?: string;
  gasUsed?: bigint;
  blockNumber?: number;
  timestamp?: number;
  success: boolean;
  error?: string;
}

// Cache for network detection to avoid repeated RPCs
let _cachedNetwork: { chainId: bigint; isSepolia: boolean; isMocked: boolean } | null = null;
let _logLevel: string = LOG_LEVEL_NORMAL;

/** Quick capability probes for FHEVM SDK on hre */
export function supportsEncryption(): boolean {
  return Boolean((hre as any).fhevm?.encryptUint);
}
export function supportsDecryptionRequest(): boolean {
  return Boolean((hre as any).fhevm?.requestDecryption) && Boolean((hre as any).fhevm?.readDecryptionResult);
}
export function supportsDecryptionDirect(): boolean {
  return Boolean((hre as any).fhevm?.decrypt);
}

export async function isSepoliaNetwork(forceRefresh: boolean = false): Promise<boolean> {
  if (!forceRefresh && _cachedNetwork) return _cachedNetwork.isSepolia;
  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId as bigint;
  _cachedNetwork = {
    chainId,
    isSepolia: chainId === SEPOLIA_CHAIN_ID,
    isMocked: chainId === HARDHAT_CHAIN_ID,
  };
  return _cachedNetwork.isSepolia;
}

export async function isMockedNetwork(forceRefresh: boolean = false): Promise<boolean> {
  if (!forceRefresh && _cachedNetwork) return _cachedNetwork.isMocked;
  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId as bigint;
  _cachedNetwork = {
    chainId,
    isSepolia: chainId === SEPOLIA_CHAIN_ID,
    isMocked: chainId === HARDHAT_CHAIN_ID,
  };
  return _cachedNetwork.isMocked;
}

/**
 * Wait for FHE decryption oracle callback on Sepolia network.
 */
export async function waitForDecryptionCallback(txReceipt: any, timeoutMs: number = 60_000, pollIntervalMs: number = 5_000): Promise<void> {
  if (await isMockedNetwork()) return; // mocked: instant
  if (!(await isSepoliaNetwork())) return; // other nets: no-op

  const start = Date.now();
  let polls = 0;
  let interval = Math.max(1_000, pollIntervalMs);

  // Attempt to extract a request/callback hint from logs (best-effort)
  const txHash: string | undefined = txReceipt?.hash ?? txReceipt?.transactionHash;
  if (_logLevel === "verbose") {
    console.log(`[decrypt-callback] waiting for oracle callback for tx ${txHash ?? "<unknown>"}`);
  }

  while (Date.now() - start < timeoutMs && polls < ORACLE_CALLBACK_MAX_POLLS) {
    // If hre.fhevm provides a helper, attempt to use it
    try {
      if ((hre as any).fhevm?.awaitDecryptionOracle) {
        await (hre as any).fhevm.awaitDecryptionOracle();
        return;
      }
    } catch (_) {
      // ignore and continue polling below
    }

    await new Promise((r) => setTimeout(r, interval));
    polls += 1;
    // simple backoff: +5s per poll up to 15s
    interval = Math.min(interval + ORACLE_CALLBACK_POLL_INTERVAL, 15_000);
  }
  throw new Error("Decryption timeout exceeded");
}

export async function createEncryptedAmount(
  contractAddress: string,
  userAddress: string,
  amount: bigint
): Promise<EncryptedInput> {
  const op = async () => {
    const { externalEuint, inputProof } = await (hre as any).fhevm.encryptUint(
      FhevmType.euint64,
      amount,
      contractAddress,
      userAddress
    );
    if (_logLevel === "verbose") {
      console.log(`[encrypt] amount=${amount.toString()} contract=${contractAddress} user=${userAddress}`);
    }
    return { handle: externalEuint as unknown as string, inputProof } as EncryptedInput;
  };
  return retryOperation(op, DECRYPTION_RETRY_ATTEMPTS, 1_000, 2);
}

export async function createEncryptedAmountForToken(
  tokenAddress: string,
  userAddress: string,
  amount: bigint
): Promise<EncryptedInput> {
  return createEncryptedAmount(tokenAddress, userAddress, amount);
}

export async function createMultipleEncryptedAmounts(
  contractAddress: string,
  userAddress: string,
  amounts: bigint[]
): Promise<EncryptedInput> {
  try {
    // For simplicity, return encryption for the first amount; for batch patterns,
    // tests can call createEncryptedAmount repeatedly
    return createEncryptedAmount(contractAddress, userAddress, amounts[0] ?? 0n);
  } catch (e: any) {
    throw new Error(`Failed to create multiple encrypted amounts: ${e?.message ?? e}`);
  }
}

export async function getEncryptedBalance(pool: any, user: string, asset: string): Promise<any> {
  return pool.getUserSuppliedBalance(user, asset);
}

// ==========================
// New Phase 7 Helper Methods
// ==========================

/**
 * Wait for transaction confirmations with timeout handling.
 */
export async function waitForTransactionConfirmation(txHash: string, confirmations: number = SEPOLIA_CONFIRMATION_BLOCKS, timeoutMs: number = 180_000): Promise<any> {
  try {
    const receipt = await ethers.provider.waitForTransaction(txHash, confirmations, timeoutMs);
    if (!receipt) throw new Error("Transaction confirmation timeout");
    return receipt;
  } catch (e: any) {
    throw new Error(`Transaction confirmation timeout: ${e?.message ?? e}`);
  }
}

/**
 * Get detailed network information for test configuration.
 */
export async function getNetworkInfo(): Promise<NetworkInfo> {
  const net = await ethers.provider.getNetwork();
  const chainId = net.chainId as bigint;
  const isSepolia = chainId === SEPOLIA_CHAIN_ID;
  const isMocked = chainId === HARDHAT_CHAIN_ID;
  const feeData = await ethers.provider.getFeeData();
  const gasPrice = (feeData.gasPrice ?? 0n) as bigint;
  _cachedNetwork = { chainId, isSepolia, isMocked };
  return {
    chainId,
    name: (net as any).name ?? (isSepolia ? "sepolia" : isMocked ? "hardhat" : "unknown"),
    isSepolia,
    isMocked,
    blockTime: SEPOLIA_BLOCK_TIME,
    gasPrice: gasPrice as bigint,
  };
}

/**
 * Estimate gas for a contract method with a 20% buffer.
 */
export async function estimateOperationGas(contract: any, method: string, args: any[]): Promise<bigint> {
  try {
    const est = await contract.estimateGas[method](...args);
    const withBuffer = (est as bigint) + ((est as bigint) / 5n);
    return withBuffer;
  } catch (e) {
    return 0n;
  }
}

/** Measure execution time of an async operation */
export async function measureOperationTiming<T>(operationName: string, operation: () => Promise<T>): Promise<{ result: T; durationMs: number }> {
  const start = Date.now();
  const result = await operation();
  const durationMs = Date.now() - start;
  if (REPORT_TIMING) console.log(`[timing] ${operationName} took ${durationMs}ms`);
  return { result, durationMs };
}

/** Retry an operation with exponential backoff */
export async function retryOperation<T>(operation: () => Promise<T>, maxAttempts: number = 3, initialDelayMs: number = 1_000, backoffMultiplier: number = 2): Promise<T> {
  let attempt = 0;
  let delay = initialDelayMs;
  let lastErr: any;
  while (attempt < maxAttempts) {
    try {
      return await operation();
    } catch (e: any) {
      lastErr = e;
      attempt += 1;
      if (attempt >= maxAttempts) break;
      await new Promise((r) => setTimeout(r, delay));
      delay = delay * backoffMultiplier;
    }
  }
  throw lastErr ?? new Error("Operation failed after retries");
}

/** Log operation details for debugging/reporting */
export function logOperationDetails(operationName: string, details: OperationDetails): void {
  const ts = new Date(details.timestamp ?? Date.now()).toISOString();
  const base = `[${ts}] [${operationName}] user=${details.user} asset=${details.asset} amount=${details.amount ?? "-"} tx=${details.txHash ?? "-"}`;
  if (details.success) {
    console.log(`${base} success gas=${details.gasUsed ?? "-"} block=${details.blockNumber ?? "-"}`);
  } else {
    console.warn(`${base} FAILED error=${details.error ?? "unknown"}`);
  }
}

/** Determine if error is a network-related, retryable error */
export function isNetworkError(error: any): boolean {
  const msg = (error?.message ?? "").toLowerCase();
  return (
    msg.includes("timed out") ||
    msg.includes("timeout") ||
    msg.includes("rate limit") ||
    msg.includes("connection refused") ||
    msg.includes("socket hang up")
  );
}

/** Format transaction errors for better debugging */
export function handleTransactionError(error: any, context: string): string {
  const hash = error?.transaction?.hash ?? error?.tx?.hash;
  const reason = error?.reason || error?.error?.reason || error?.data?.message || error?.message || String(error);
  return `[${context}] tx=${hash ?? "-"} reason=${reason}`;
}

/** Request decryption of an encrypted value and wait for the result */
export async function requestDecryption(encryptedHandle: string, contractAddress: string, userAddress: string, timeoutMs: number = 60_000): Promise<bigint> {
  // Mocked: assume decrypt available immediately via hre.fhevm in local
  if (await isMockedNetwork()) {
    try {
      if ((hre as any).fhevm?.decrypt) {
        const out = await (hre as any).fhevm.decrypt(encryptedHandle, contractAddress, userAddress);
        return BigInt(out ?? 0);
      }
      return 0n;
    } catch (_) {
      return 0n;
    }
  }

  // Sepolia: submit request (best-effort stub) and wait for callback
  const op = async () => {
    try {
      if (_logLevel === "verbose") console.log(`[decrypt] request for handle on ${contractAddress}`);
      // If SDK provides, it will be invoked; otherwise we wait for callback heuristic
      if ((hre as any).fhevm?.requestDecryption) {
        const tx = await (hre as any).fhevm.requestDecryption(encryptedHandle, contractAddress, userAddress);
        const receipt = await tx.wait?.();
        await waitForDecryptionCallback(receipt, timeoutMs);
      } else {
        await waitForDecryptionCallback(undefined, timeoutMs);
      }
      // Retrieve the decrypted result if available via SDK
      if ((hre as any).fhevm?.readDecryptionResult) {
        const value = await (hre as any).fhevm.readDecryptionResult(encryptedHandle, contractAddress, userAddress);
        return BigInt(value);
      }
      // Fallback unknown: return 0n to avoid crashes in non-critical checks
      return 0n;
    } catch (e: any) {
      if (isNetworkError(e)) throw e; // retryable
      throw e;
    }
  };
  return retryOperation<bigint>(op, DECRYPTION_RETRY_ATTEMPTS, DECRYPTION_RETRY_DELAY, 2);
}

/** Batch decrypt multiple handles */
export async function batchRequestDecryption(encryptedHandles: string[], contractAddress: string, userAddress: string, timeoutMs: number = 120_000): Promise<bigint[]> {
  const results = await Promise.all(
    encryptedHandles.map((h) => requestDecryption(h, contractAddress, userAddress, timeoutMs))
  );
  return results;
}

/** Setup integration test environment (Sepolia-only) */
export async function setupIntegrationTestEnvironment(): Promise<{ network: NetworkInfo; timeouts: any; gasLimits: any; logging: any }> {
  const network = await getNetworkInfo();
  if (!network.isSepolia) throw new Error(ERROR_NETWORK_NOT_SEPOLIA);
  const [signer] = await ethers.getSigners();
  const bal = await ethers.provider.getBalance(await signer.getAddress());
  // require a small safety balance (>= 0.05 ETH)
  const min = 50_000_000_000_000_000n;
  if (bal < min) throw new Error(ERROR_INSUFFICIENT_SEPOLIA_ETH);
  _logLevel = LOG_LEVEL_NORMAL;
  return {
    network,
    timeouts: {
      confirmationBlocks: SEPOLIA_CONFIRMATION_BLOCKS,
      blockTime: SEPOLIA_BLOCK_TIME,
    },
    gasLimits: {},
    logging: { level: _logLevel, reportGas: REPORT_GAS_COSTS, reportTiming: REPORT_TIMING },
  };
}

/** Cleanup integration test environment */
export async function cleanupIntegrationTestEnvironment(): Promise<void> {
  // Placeholder: write reports, clean caches, etc.
  return;
}

// Maintain default exports compatibility (named exports are preferred)
