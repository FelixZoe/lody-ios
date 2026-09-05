import { useRouter } from 'expo-router';
import { NativeGroupedList, type NativeListRow } from '@lody-ios/kit';
import { useAuth } from '@/features/auth/AuthProvider';
export default function SettingsScreen() {
  const auth = useAuth(),
    router = useRouter();
  const sections: NativeListRow[][] = [
    [
      {
        id: 'account',
        title: auth.account?.user.name ?? '欢迎使用 Lody',
        subtitle: auth.account?.user.email ?? '登录后连接你的工作区',
      },
    ],
    [
      {
        id: 'about',
        title: 'Lody for iOS',
        subtitle: '随时查看项目，与电脑上的智能助手继续对话。',
      },
    ],
  ];
  if (auth.account && !auth.busy)
    sections[0].push({
      id: 'auth-logout',
      title: '退出登录',
      action: true,
      destructive: true,
    });
  if (auth.error)
    sections.push([
      { id: 'auth-error', title: '连接出现问题', subtitle: auth.error },
    ]);
  if (__DEV__)
    sections.push([
      {
        id: 'debug-open',
        title: 'Debug',
        action: true,
        disclosure: true,
        navigates: true,
      },
    ]);
  return (
    <NativeGroupedList
      style={{ flex: 1 }}
      sections={sections}
      onRowPress={({ nativeEvent }) => {
        if (nativeEvent.id === 'debug-open') router.push('/debug');
        if (nativeEvent.id === 'auth-logout') void auth.logout();
      }}
    />
  );
}
