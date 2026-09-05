import { usePalette } from '@/ui/theme';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
export default function TabsLayout() {
  const colors = usePalette();
  return (
    <NativeTabs tintColor={colors.primary}>
      <NativeTabs.Trigger name="machines">
        <NativeTabs.Trigger.Icon sf="folder" />
        <NativeTabs.Trigger.Label>项目</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon sf="gearshape" />
        <NativeTabs.Trigger.Label>设置</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
