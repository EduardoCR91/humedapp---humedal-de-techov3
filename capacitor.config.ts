import type { CapacitorConfig } from '@capacitor/cli';

const config = {
  appId: 'com.ecovigia.app',
  appName: 'ecovigia-humedal-app',
  webDir: 'dist',
  bundledWebRuntime: false,
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
