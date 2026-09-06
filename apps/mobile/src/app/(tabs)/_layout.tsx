import { usePalette } from '@/theme/palette';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
export default function TabsLayout() {
  const colors = usePalette();
  return (
    <NativeTabs tintColor={colors.accent}>
      <NativeTabs.Trigger name="sessions">
        <NativeTabs.Trigger.Icon sf="bubble.left.and.text.bubble.right" />
        <NativeTabs.Trigger.Label>会话</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon sf="gearshape" />
        <NativeTabs.Trigger.Label>设置</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
