"use client";

import { useEffect, useRef } from 'react';
import { alpha, useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';

/**
 * ProtocolViz
 * A lightweight canvas animation evoking encrypted data flow:
 *  - Central core node
 *  - Orbiting smaller nodes following slightly noisy circular paths
 *  - Subtle connecting arcs and pulsing opacity
 *  - Low CPU: capped objects & requestAnimationFrame loop
 */
export default function ProtocolViz() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const theme = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrame: number;
    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    // Configuration
    const nodeCount = 14;
    const nodes: Array<{
      radius: number;
      angle: number;
      dist: number;
      speed: number;
      pulse: number;
      pulseSpeed: number;
      offset: number;
    }> = [];
    for (let i = 0; i < nodeCount; i++) {
      nodes.push({
        radius: 3 + Math.random() * 3,
        angle: Math.random() * Math.PI * 2,
        dist: 60 + Math.random() * 110,
        speed: 0.0008 + Math.random() * 0.0015,
        pulse: Math.random(),
        pulseSpeed: 0.005 + Math.random() * 0.01,
        offset: Math.random() * 200,
      });
    }

    const primary = theme.palette.primary.main;
    const bgGlow = alpha(primary, 0.08);
    const lineColor = alpha(primary, 0.25);
    const coreColor = primary;
    const coreGradientCache: { g?: CanvasGradient; w?: number; h?: number } = {};

    function drawCore(cx: number, cy: number) {
      if (!coreGradientCache.g || coreGradientCache.w !== canvas.width || coreGradientCache.h !== canvas.height) {
        const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, 140);
        g.addColorStop(0, alpha(coreColor, 0.55));
        g.addColorStop(0.35, alpha(coreColor, 0.18));
        g.addColorStop(1, 'transparent');
        coreGradientCache.g = g;
        coreGradientCache.w = canvas.width;
        coreGradientCache.h = canvas.height;
      }
      ctx.beginPath();
      ctx.fillStyle = coreGradientCache.g!;
      ctx.arc(cx, cy, 140, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.fillStyle = coreColor;
      ctx.shadowColor = coreColor;
      ctx.shadowBlur = 16;
      ctx.arc(cx, cy, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    function render(ts: number) {
      const { width, height } = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, width, height);
      const cx = width / 2;
      const cy = height / 2;

      // Core
      drawCore(cx, cy);

      // Semi-random subtle background ring
      ctx.beginPath();
      ctx.strokeStyle = alpha(primary, 0.12);
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.arc(cx, cy, 100, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Update & draw nodes
      nodes.forEach((n, idx) => {
        n.angle += n.speed;
        n.pulse += n.pulseSpeed;
        const noise = Math.sin((ts + n.offset) * 0.0005) * 8;
        const dist = n.dist + noise;
        const x = cx + Math.cos(n.angle) * dist;
        const y = cy + Math.sin(n.angle) * dist * 0.88; // slight vertical ellipse

        // Connection line to core (fade based on distance)
        const lineAlpha = Math.min(1, Math.max(0, 1 - dist / 220));
        ctx.beginPath();
        ctx.strokeStyle = alpha(lineColor, lineAlpha);
        ctx.lineWidth = 1;
        ctx.moveTo(cx, cy);
        ctx.lineTo(x, y);
        ctx.stroke();

        // Occasional arc between neighbors
        if (idx % 3 === 0) {
            const next = nodes[(idx + 3) % nodes.length];
            const nx = cx + Math.cos(next.angle) * (next.dist + Math.sin((ts + next.offset) * 0.0005) * 8);
            const ny = cy + Math.sin(next.angle) * (next.dist + Math.sin((ts + next.offset) * 0.0005) * 8) * 0.88;
            ctx.beginPath();
            ctx.strokeStyle = alpha(primary, 0.07);
            ctx.moveTo(x, y);
            ctx.lineTo(nx, ny);
            ctx.stroke();
        }

        // Node
        const pulseScale = 0.55 + Math.sin(n.pulse) * 0.45;
        ctx.beginPath();
        ctx.fillStyle = alpha(primary, 0.25 + 0.5 * pulseScale);
        ctx.shadowColor = bgGlow;
        ctx.shadowBlur = 6 * pulseScale;
        ctx.arc(x, y, n.radius * (0.7 + 0.6 * pulseScale), 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Inner solid core of node
        ctx.beginPath();
        ctx.fillStyle = alpha(primary, 0.9);
        ctx.arc(x, y, Math.max(1, n.radius * 0.45), 0, Math.PI * 2);
        ctx.fill();
      });

      animationFrame = requestAnimationFrame(render);
    }

    animationFrame = requestAnimationFrame(render);
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrame);
    };
  }, [theme]);

  return (
    <Box
      sx={{
        width: '100%',
        height: { xs: 280, md: 420 },
        position: 'relative',
        opacity: 0.9,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          filter: 'drop-shadow(0 0 24px rgba(0,0,0,0.6))',
        }}
      />
      {/* Soft overlay gradient for subtle fade */}
      <Box
        sx={{
          pointerEvents: 'none',
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(circle at 65% 40%, ${alpha(theme.palette.primary.main, 0.25)} 0%, transparent 60%)`,
          mixBlendMode: 'screen',
        }}
      />
    </Box>
  );
}
