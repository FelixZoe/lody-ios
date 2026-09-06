import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Lody',
  slug: 'lody-ios',
  version: '0.1.0',
  platforms: ['ios'],
  scheme: 'lody-ios',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  icon: './assets/icon.png',
  ios: {
    bundleIdentifier: 'app.innei.lody',
    supportsTablet: false,
  },
  plugins: ['expo-router', ['expo-dev-client', { toolsButton: false }]],
  experiments: { typedRoutes: true, reactCompiler: true },
};

export default config;
