import { createConfig, http } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { NETWORK_CONFIG } from './contracts';
import { getDefaultConfig } from 'connectkit';

// Create wagmi config with ConnectKit only
export const config = createConfig(
  getDefaultConfig({
    appName: 'Nexora - Confidential Lending',
    appDescription: 'Fully encrypted lending protocol using Zama FHEVM technology',
    appUrl: 'https://nexora.vercel.app',
    appIcon: 'https://nexora.vercel.app/icon.png',
    chains: [sepolia],
    transports: {
      [sepolia.id]: http(NETWORK_CONFIG.rpcUrl),
    },
    walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'placeholder_project_id',
  })
);
