import React from 'react';
import { Box, LinearProgress, Typography } from '@mui/material';

export interface UtilizationRateBarProps {
  utilization: number; // 0-100
  size?: 'small' | 'medium' | 'large';
  showPercentage?: boolean;
  decimals?: number;
  lowThreshold?: number; // green -> yellow
  highThreshold?: number; // yellow -> red
  isDarkMode?: boolean;
}

const widthMap = { small: 60, medium: 80, large: 120 };
const heightMap = { small: 4, medium: 6, large: 8 };

const UtilizationRateBar: React.FC<UtilizationRateBarProps> = ({
  utilization,
  size = 'medium',
  showPercentage = true,
  decimals = 1,
  lowThreshold = 50,
  highThreshold = 80,
}) => {
  const clamped = Math.min(100, Math.max(0, utilization));
  const color = clamped > highThreshold ? 'error' : clamped > lowThreshold ? 'warning' : 'success';
  const formatted = `${clamped.toFixed(decimals)}%`;
  const w = widthMap[size] ?? widthMap.medium;
  const h = heightMap[size] ?? heightMap.medium;

  return (
    <Box display="flex" alignItems="center" gap={1} aria-label={`Utilization rate: ${formatted}`}>
      <Box sx={{ width: w }} role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100}>
        <LinearProgress variant="determinate" value={clamped} color={color as any} sx={{ height: h }} />
      </Box>
      {showPercentage && (
        <Typography variant="caption">{formatted}</Typography>
      )}
    </Box>
  );
};

export default UtilizationRateBar;
