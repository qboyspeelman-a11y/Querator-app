import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.querator.shuttle',
  appName: 'Querator Shuttle',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
