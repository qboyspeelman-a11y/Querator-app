import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.querator.shuttle', // Use your exact bundle/package ID
  appName: 'Querator',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  android: {
    // Add custom scheme handling here if needed, or via AndroidManifest.xml
  }
};

export default config;
