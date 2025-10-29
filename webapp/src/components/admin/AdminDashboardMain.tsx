'use client';

import { useState } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Paper,
} from '@mui/material';
import ReservesPanel from './ReservesPanel';
import AddReservePanel from './AddReservePanel';
import PricesPanel from './PricesPanel';
import RolesPanelEnhanced from './RolesPanelEnhanced';
import EmergencyPanel from './EmergencyPanel';
import ReserveConfigPanel from './ReserveConfigPanel';
import PoolSettingsPanel from './PoolSettingsPanel';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

export default function AdminDashboardMain() {
  const [activeTab, setActiveTab] = useState(0);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const tabs = [
    { label: '📊 Overview', icon: '📊' },
    { label: '➕ Add Reserve', icon: '➕' },
    { label: '⚙️ Configure', icon: '⚙️' },
    { label: '💰 Prices', icon: '💰' },
    { label: '👥 Roles', icon: '👥' },
    { label: '🚨 Emergency', icon: '🚨' },
    { label: '🧩 Pool Settings', icon: '🧩' },
  ];

  return (
    <Box>
      {/* Welcome Header */}
      <Box sx={{ mb: 4 }}>
        <Typography 
          variant="h4" 
          gutterBottom 
          sx={{ 
            color: 'white', 
            fontWeight: 700,
            textShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
          }}
        >
          Protocol Management
        </Typography>
        <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
          Manage reserves, update prices, configure roles, and handle emergencies
        </Typography>
      </Box>

      {/* Navigation Tabs */}
      <Paper 
        sx={{ 
          mb: 3, 
          background: 'rgba(255, 255, 255, 0.05)', 
          backdropFilter: 'blur(10px)',
        }}
      >
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="fullWidth"
          sx={{
            '& .MuiTab-root': {
              color: 'rgba(255, 255, 255, 0.6)',
              fontWeight: 600,
              fontSize: '0.95rem',
              py: 2,
            },
            '& .Mui-selected': {
              color: '#4fc3f7 !important',
            },
            '& .MuiTabs-indicator': {
              backgroundColor: '#4fc3f7',
              height: '3px',
            },
          }}
        >
          {tabs.map((tab, index) => (
            <Tab key={index} label={tab.label} />
          ))}
        </Tabs>
      </Paper>

      {/* Tab Content */}
      <TabPanel value={activeTab} index={0}>
        <ReservesPanel />
      </TabPanel>

      <TabPanel value={activeTab} index={1}>
        <AddReservePanel />
      </TabPanel>

      <TabPanel value={activeTab} index={2}>
        <ReserveConfigPanel />
      </TabPanel>

      <TabPanel value={activeTab} index={3}>
        <PricesPanel />
      </TabPanel>

      <TabPanel value={activeTab} index={4}>
        <RolesPanelEnhanced />
      </TabPanel>

      <TabPanel value={activeTab} index={5}>
        <EmergencyPanel />
      </TabPanel>

      <TabPanel value={activeTab} index={6}>
        <PoolSettingsPanel />
      </TabPanel>
    </Box>
  );
}


