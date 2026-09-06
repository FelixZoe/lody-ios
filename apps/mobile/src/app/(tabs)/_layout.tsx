import { useRouter } from 'expo-router';
import { usePalette } from '@/theme/palette';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
export default function TabsLayout() {
  const colors = usePalette();
  const router = useRouter();
  return (
    <NativeTabs tintColor={colors.accent} backBehavior="history">
      <NativeTabs.Trigger name="sessions" disablePopToTop disableScrollToTop>
        <NativeTabs.Trigger.Icon sf="bubble.left.and.text.bubble.right" />
        <NativeTabs.Trigger.Label>会话</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon sf="gearshape" />
        <NativeTabs.Trigger.Label>设置</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        name="search-action"
        role="search"
        disabled
        listeners={{ tabPress: () => router.navigate('/search') }}
      >
        <NativeTabs.Trigger.Label>搜索</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
