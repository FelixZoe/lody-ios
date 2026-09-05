import { Stack } from 'expo-router';
import { softScrollEdgeEffects } from '@/ui/Screen';
export default function Layout() {
  return (
    <Stack
      screenOptions={{
        headerTransparent: true,
        headerShadowVisible: false,
        scrollEdgeEffects: softScrollEdgeEffects,
      }}
    >
      <Stack.Screen
        name="index"
        options={{ title: '设置', headerLargeTitle: true }}
      />
    </Stack>
  );
}
