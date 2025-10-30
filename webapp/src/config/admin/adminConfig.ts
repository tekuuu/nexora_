/**
 * Admin Configuration
 * Defines admin wallets and access control
 *
 * Admin wallets are now configured via environment variables in .env.local
 */

import { ADMIN_WALLETS } from '../contracts';

export { ADMIN_WALLETS };

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


