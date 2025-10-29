'use client';

import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminDashboardMain from '@/components/admin/AdminDashboardMain';

/**
 * Note:
 * Global web3 providers (Wagmi, React Query, ConnectKit) are already set up in
 * [webapp/src/app/layout.tsx](webapp/src/app/layout.tsx) via the shared
 * [webapp/src/components/Providers.tsx](webapp/src/components/Providers.tsx).
 * Avoid re-wrapping here to prevent "Multiple, nested usages of ConnectKitProvider" runtime errors.
 */

// Create dark theme for admin
const adminTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#4fc3f7',
    },
    secondary: {
      main: '#f5576c',
    },
    success: {
      main: '#51cf66',
    },
    error: {
      main: '#ff6b6b',
    },
  },
  typography: {
    fontFamily: 'sans-serif',
    h1: {
      fontFamily: 'sans-serif',
      fontWeight: 700,
    },
    h2: {
      fontFamily: 'sans-serif',
      fontWeight: 600,
    },
    h3: {
      fontFamily: 'sans-serif',
      fontWeight: 600,
    },
    h4: {
      fontFamily: 'sans-serif',
      fontWeight: 600,
    },
    h5: {
      fontFamily: 'sans-serif',
      fontWeight: 600,
    },
    h6: {
      fontFamily: 'sans-serif',
      fontWeight: 600,
    },
    button: {
      textTransform: 'none',
      fontWeight: 600,
    },
  },
});

export default function AdminPage() {
  return (
    <ThemeProvider theme={adminTheme}>
      <CssBaseline />
      <AdminLayout>
        <AdminDashboardMain />
      </AdminLayout>
    </ThemeProvider>
  );
}

