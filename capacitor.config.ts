import type { CapacitorConfig } from '@capacitor/cli';

const config = {
  appId: 'com.ecovigia.app',
  appName: 'Humedales-app',
  webDir: 'dist',
  bundledWebRuntime: false,
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
