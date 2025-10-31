import type { Metadata } from 'next';
import './globals.css';
import ConsoleFilter from '../components/ConsoleFilter';
import ClientThemeProvider from '../components/ClientThemeProvider';
import ThemeProvider from '../contexts/ThemeContext';
import EmotionRegistry from '../lib/emotionRegistry';
import Providers from '../components/Providers';

export const metadata: Metadata = {
  title: 'Nexora - Confidential Lending Protocol',
  description: 'Privacy-first lending protocol using FHE technology',
  icons: {
    icon: '/assets/logos/logo.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Prevent hydration mismatch by ensuring consistent styling */}
        <meta name="emotion-insertion-point" content="" />
      </head>
      <body style={{ 
        fontFamily: 'sans-serif',
        fontWeight: '400',
        letterSpacing: '-0.01em'
      }}>
        <EmotionRegistry>
          <ThemeProvider>
            <ClientThemeProvider>
              <Providers>
                <ConsoleFilter />
                {children}
              </Providers>
            </ClientThemeProvider>
          </ThemeProvider>
        </EmotionRegistry>
      </body>
    </html>
  );
}
