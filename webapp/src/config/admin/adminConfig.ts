/**
 * Admin Configuration
 * Defines admin wallets and access control
 */

// Admin wallet addresses (POOL_ADMIN role holders)
export const ADMIN_WALLETS = [
  '0xcC5C64e2Ff52d9b2D95B5dc9d4B1e9Edf232693B', // Deployer
  // Add more admin addresses here as needed
].map(addr => addr.toLowerCase());

/**
 * Check if a wallet address is an admin
 */
export function isAdminWallet(address: string | undefined): boolean {
  if (!address) return false;
  return ADMIN_WALLETS.includes(address.toLowerCase());
}

/**
 * Admin route configuration
 */
export const ADMIN_ROUTES = {
  DASHBOARD: '/admin',
  RESERVES: '/admin/reserves',
  PRICES: '/admin/prices',
  ROLES: '/admin/roles',
  EMERGENCY: '/admin/emergency',
} as const;

/**
 * Admin navigation items
 */
export const ADMIN_NAV_ITEMS = [
  { label: 'Reserves', value: 'reserves', icon: '📊' },
  { label: 'Prices', value: 'prices', icon: '💰' },
  { label: 'Roles', value: 'roles', icon: '👥' },
  { label: 'Emergency', value: 'emergency', icon: '🚨' },
] as const;


