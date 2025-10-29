'use client';

import { useEffect } from 'react';

export default function ConsoleFilter() {
  useEffect(() => {
    // Only run in browser environment to avoid hydration issues
    if (typeof window === 'undefined') {
      return;
    }

    // Store original console.error once
    const originalConsoleError = console.error.bind(console);
    
    // Create wrapped version
    const wrappedConsoleError = (...args: any[]) => {
      try {
        const message = args.map((a) => {
          if (typeof a === 'string') return a;
          if (a && typeof a.message === 'string') return a.message;
          try { return JSON.stringify(a); } catch { return String(a); }
        }).join(' ');
        
        // Suppress common noisy network errors
        if (
          message.includes('429') ||
          message.includes('Too Many Requests') ||
          message.includes('sepolia.infura.io') ||
          message.includes('POST https://sepolia.infura.io') ||
          message.includes('relayer-sdk-js.umd.cjs') ||
          message.includes('WebSocket connection closed abnormally') ||
          message.includes('Unauthorized: invalid key')
        ) {
          return; // Don't log these errors
        }
        originalConsoleError(...args);
      } catch {
        // Fallback to raw logging to avoid breaking the app
        originalConsoleError(...args);
      }
    };

    // Replace console.error
    console.error = wrappedConsoleError;

    // Cleanup function to restore original console.error
    return () => {
      console.error = originalConsoleError;
    };
  }, []); // Empty dependency array - only run once on mount

  return null; // This component doesn't render anything
}
