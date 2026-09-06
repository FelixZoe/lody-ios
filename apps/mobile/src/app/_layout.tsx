import { Stack, ThemeProvider } from 'expo-router';
import { CatalogProvider } from '@/cloud/CatalogProvider';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { nativePresentationOptions } from '@/presentation';
import { navigationThemes } from '@/theme/palette';
import { softScrollEdgeEffects } from '@/ui/Screen';

export const unstable_settings = { initialRouteName: '(tabs)' };

export default function RootLayout() {
  const theme =
    useColorScheme() === 'dark'
      ? navigationThemes.dark
      : navigationThemes.light;
  return (
    <ThemeProvider value={theme}>
      <AuthProvider>
        <CatalogProvider>
          <StatusBar style="auto" />
          <Stack
            screenOptions={{
              headerTransparent: true,
              headerLargeTitle: false,
              headerBackButtonDisplayMode: 'minimal',
              headerShadowVisible: false,
              scrollEdgeEffects: softScrollEdgeEffects,
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="search"
              options={{
                title: '',
                headerShown: false,
                animation: 'fade',
                animationDuration: 180,
              }}
            />
            <Stack.Screen name="debug" options={{ title: 'Debug' }} />
            <Stack.Screen name="environment" options={{ title: '运行环境' }} />
            <Stack.Screen
              name="presented/[presentationId]"
              options={({ route }) =>
                nativePresentationOptions(route.params, theme.colors.background)
              }
            />
          </Stack>
        </CatalogProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
