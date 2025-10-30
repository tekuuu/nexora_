/**
 * Financial calculation utilities for the webapp.
 * All functions are pure and side-effect free.
 */

/**
 * Calculate utilization rate as a percentage (0-100) using bigint arithmetic.
 * Uses a basis-points scale to preserve two decimal places during integer math.
 *
 * @param totalBorrowed bigint | null - total borrowed (raw units)
 * @param totalSupplied bigint | null - total supplied (raw units)
 * @returns number - utilization percentage between 0 and 100 (may include decimals)
 */
export function calculateUtilizationRate(totalBorrowed: bigint | null, totalSupplied: bigint | null): number {
  try {
    if (!totalBorrowed || !totalSupplied) return 0;
    if (totalSupplied === BigInt(0)) return 0;

    const scale = BigInt(10000); // basis points with two decimal places
    const ratioBp = (totalBorrowed * scale) / totalSupplied; // integer basis points
    const percent = Number(ratioBp) / 100; // convert basis points to percent
    if (!Number.isFinite(percent) || Number.isNaN(percent)) return 0;
    return percent;
  } catch (e) {
    return 0;
  }
}

/**
 * Convenience overload that accepts string inputs and converts to bigint.
 * Returns 0 on invalid input.
 */
export function calculateUtilizationRateFromStrings(totalBorrowed: string, totalSupplied: string): number {
  try {
    const b = BigInt(totalBorrowed);
    const s = BigInt(totalSupplied);
    return calculateUtilizationRate(b, s);
  } catch (e) {
    return 0;
  }
}


