'use client';

import { ReactNode, useState } from 'react';
import { WagmiProvider } from 'wagmi';
import { config } from '../config/wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConnectKitProvider } from 'connectkit';

type Props = { children: ReactNode };

export default function Providers({ children }: Props) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider
          mode="dark"
          options={{
            hideBalance: true,
            overlayBlur: 8,
            initialChainId: (config as any).chains?.[0]?.id,
          }}
        >
          {children}
        </ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}