 'use client';

import { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Grid,
  AppBar,
  Toolbar,
  IconButton,
  useTheme,
  useMediaQuery,
  Stack,
  alpha,
} from '@mui/material';
import { Menu as MenuIcon, Close, GitHub, Twitter, Telegram } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import ProtocolViz from './ProtocolViz';

export default function LandingPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLaunchApp = () => {
    try {
      router.push('/dashboard');
    } catch (e) {
      window.location.href = '/dashboard';
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#061018', backgroundImage: 'radial-gradient(800px 300px at 12% 12%, rgba(255,255,255,0.02), transparent)' }}>
      {/* Navigation */}
      <AppBar position="static" sx={{ bgcolor: 'rgba(255,255,255,0.02)', backdropFilter: 'blur(6px)', boxShadow: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <Toolbar>
          <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
            <Image src="/assets/logos/logo.svg" alt="Nexora Logo" width={36} height={36} style={{ marginRight: 12 }} />
            <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.02em', color: 'common.white' }}>Nexora</Typography>
          </Box>

          {!isMobile ? (
            <Stack direction="row" spacing={2} alignItems="center">
              <Button color="inherit" sx={{ fontWeight: 500, color: 'rgba(255,255,255,0.75)' }}>Features</Button>
              <Button color="inherit" sx={{ fontWeight: 500, color: 'rgba(255,255,255,0.75)' }}>Documentation</Button>
              <Button color="inherit" sx={{ fontWeight: 500, color: 'rgba(255,255,255,0.75)' }}>About</Button>
              <Button
                variant="contained"
                onClick={handleLaunchApp}
                sx={{
                  bgcolor: 'primary.main',
                  color: 'common.black',
                  borderRadius: 1,
                  px: 3,
                  py: 1.1,
                  fontWeight: 700,
                  '&:hover': { bgcolor: 'primary.dark' },
                }}
              >
                Launch App
              </Button>
            </Stack>
          ) : (
            <IconButton color="inherit" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>{mobileMenuOpen ? <Close /> : <MenuIcon />}</IconButton>
          )}
        </Toolbar>
      </AppBar>

      {/* Mobile Menu */}
      {mobileMenuOpen && isMobile && (
        <Box sx={{ position: 'fixed', top: 64, left: 0, right: 0, bgcolor: '#071018', borderBottom: '1px solid rgba(255,255,255,0.03)', zIndex: 1200, p: 2 }}>
          <Stack spacing={2}>
            <Button color="inherit" sx={{ justifyContent: 'flex-start', color: 'rgba(255,255,255,0.75)' }}>Features</Button>
            <Button color="inherit" sx={{ justifyContent: 'flex-start', color: 'rgba(255,255,255,0.75)' }}>Documentation</Button>
            <Button color="inherit" sx={{ justifyContent: 'flex-start', color: 'rgba(255,255,255,0.75)' }}>About</Button>
            <Button
              variant="contained"
              onClick={handleLaunchApp}
              sx={{
                bgcolor: 'primary.main',
                color: 'common.black',
                borderRadius: 1,
                px: 3,
                py: 1.1,
                fontWeight: 700,
                '&:hover': { bgcolor: 'primary.dark' },
              }}
            >
              Launch App
            </Button>
          </Stack>
        </Box>
      )}

      {/* Hero + Features */}
      <Container maxWidth="lg" sx={{ pt: 10, pb: 8 }}>
        <Grid container spacing={6} alignItems="center">
          <Grid item xs={12} md={7}>
            <Typography variant="h1" sx={{ fontSize: { xs: '2rem', md: '3.4rem' }, fontWeight: 800, lineHeight: 1.04, color: 'common.white', mb: 2 }}>
              <Box component="span" sx={{ color: 'primary.main', mr: 1 }}>Confidential</Box>
              Lending Protocol
            </Typography>

            <Typography sx={{ color: 'rgba(255,255,255,0.75)', mb: 4, maxWidth: 680 }}>
              The first fully encrypted lending protocol using Zama&apos;s FHE technology. Supply and borrow tokens privately and earn yields while maintaining complete confidentiality.
            </Typography>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Button
                variant="contained"
                onClick={handleLaunchApp}
                sx={{
                  bgcolor: 'primary.main',
                  color: 'common.black',
                  px: 4,
                  py: 1.5,
                  fontWeight: 700,
                  borderRadius: 1,
                  '&:hover': { bgcolor: 'primary.dark' },
                }}
              >
                Launch App
              </Button>
              <Button variant="outlined" sx={(t) => ({ borderColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.92)', px: 4, py: 1.5, '&:hover': { borderColor: t.palette.primary.main, bgcolor: alpha(t.palette.primary.main, 0.04) } })}>View Documentation</Button>
            </Stack>
          </Grid>

          <Grid item xs={12} md={5}>
            <Box sx={{
              p: 2,
              borderRadius: 2,
              border: '1px solid rgba(255,255,255,0.04)',
              backgroundColor: 'rgba(255,255,255,0.02)'
            }}>
              <ProtocolViz />
            </Box>
          </Grid>
        </Grid>

        {/* Feature cards removed per request (inaccurate): Private Yield, Composable, Performance */}
      </Container>

      {/* Footer */}
      <Box sx={{ borderTop: '1px solid rgba(255,255,255,0.04)', py: 4, mt: 8 }}>
        <Container maxWidth="lg">
          <Grid container spacing={4} alignItems="center">
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Image src="/assets/logos/logo.svg" alt="Nexora Logo" width={32} height={32} style={{ marginRight: 8 }} />
                <Typography variant="h6" sx={{ fontWeight: 800, fontSize: '1.1rem' }}>Nexora</Typography>
              </Box>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>© 2025 Nexora. Built by Nexora-Labs. All rights reserved.</Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Stack direction="row" spacing={2} justifyContent={{ xs: 'center', md: 'flex-end' }}>
                <IconButton sx={{ color: 'rgba(255,255,255,0.75)', '&:hover': { color: 'primary.main' } }}><GitHub /></IconButton>
                <IconButton sx={{ color: 'rgba(255,255,255,0.75)', '&:hover': { color: 'primary.main' } }}><Twitter /></IconButton>
                <IconButton sx={{ color: 'rgba(255,255,255,0.75)', '&:hover': { color: 'primary.main' } }}><Telegram /></IconButton>
              </Stack>
            </Grid>
          </Grid>
        </Container>
      </Box>
    </Box>
  );
}
