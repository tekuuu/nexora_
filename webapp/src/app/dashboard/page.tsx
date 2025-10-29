'use client';

import { Box } from '@mui/material';
import Dashboard from '../../components/Dashboard';

export default function DashboardPage() {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Dashboard />
    </Box>
  );
}