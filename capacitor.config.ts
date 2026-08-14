import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.querator.shuttle',
  appName: 'Querator Shuttle',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  // Add this to handle custom URL redirects inside the native app
  plugins: {
    SplashScreen: {
      launchShowDuration: 0
    }
  }
};

export default config;
