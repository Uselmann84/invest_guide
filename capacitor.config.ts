import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.investguide.app',
  appName: 'InvestGuide',
  webDir: 'dist',
  ios: {
    contentInset: 'always',
    backgroundColor: '#060a14',
    limitsNavigationsToAppBoundDomains: false,
  },
  server: {
    iosScheme: 'investguide',
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#060a14',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#060a14',
      overlaysWebView: true,
    },
  },
};

export default config;
