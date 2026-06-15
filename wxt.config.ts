import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'PriceSentinel',
    version: '0.1.0',
    description: 'Pin competitor pricing pages and get notified when they change.',
    permissions: ['storage', 'alarms', 'notifications', 'activeTab', 'contextMenus'],
    host_permissions: [],
    optional_host_permissions: ['*://*/*'],
    icons: {
      '16': '/icons/icon-16.png',
      '48': '/icons/icon-48.png',
      '128': '/icons/icon-128.png',
    },
  },
});
