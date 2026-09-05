import { Stack, ThemeProvider } from 'expo-router';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { nativePresentationOptions } from '@/presentation';
import { lightTheme, darkTheme } from '@/ui/theme';
import { softScrollEdgeEffects } from '@/ui/Screen';

export const unstable_settings = { initialRouteName: '(tabs)' };

export default function RootLayout() {
  const theme = useColorScheme() === 'dark' ? darkTheme : lightTheme;
  return (
    <ThemeProvider value={theme}>
      <AuthProvider>
        <StatusBar style="auto" />
        <Stack
          screenOptions={{
            headerTransparent: true,
            headerBackButtonDisplayMode: 'minimal',
            headerShadowVisible: false,
            scrollEdgeEffects: softScrollEdgeEffects,
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="debug" options={{ title: 'Debug' }} />
          <Stack.Screen name="environment" options={{ title: '运行环境' }} />
          <Stack.Screen
            name="presented/[presentationId]"
            options={({ route }) =>
              nativePresentationOptions(route.params, theme.colors.background)
            }
          />
        </Stack>
      </AuthProvider>
    </ThemeProvider>
  );
}
