import hre, { ethers } from "hardhat";
import { FhevmType } from "@fhevm/mock-utils";

export interface EncryptedInput { handle: string; inputProof: string }

export interface EncryptionOptions {
  contractAddress: string;
  userAddress: string;
  gasLimit?: bigint;
}

export async function isSepoliaNetwork(): Promise<boolean> {
  const network = await ethers.provider.getNetwork();
  return network.chainId === 11155111n;
}

export async function isMockedNetwork(): Promise<boolean> {
  const network = await ethers.provider.getNetwork();
  return network.chainId === 31337n;
}

export async function waitForDecryption(_txReceipt: any, _timeoutMs: number = 60_000): Promise<void> {
  // In mocked Hardhat tests, there's no real decryption to wait for
  if (await isMockedNetwork()) return;
  // On Sepolia, you'd await hre.fhevm.awaitDecryptionOracle() here with timeout
  const start = Date.now();
  while (Date.now() - start < _timeoutMs) {
    await new Promise((r) => setTimeout(r, 500));
  }
}

export async function createEncryptedAmount(
  contractAddress: string,
  userAddress: string,
  amount: bigint
): Promise<EncryptedInput> {
  try {
  const { externalEuint, inputProof } = await (hre as any).fhevm.encryptUint(
      FhevmType.euint64,
      amount,
      contractAddress,
      userAddress
    );
    return { handle: externalEuint as unknown as string, inputProof };
  } catch (e: any) {
    throw new Error(`Failed to create encrypted amount: ${e?.message ?? e}`);
  }
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
