'use client';

import { Box } from '@mui/material';
import LandingPage from '../components/LandingPage';

export default function HomePage() {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <LandingPage />
    </Box>
  );
}
