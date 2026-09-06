import { useRouter } from 'expo-router';
import { NativeGroupedList, type NativeListSection } from '@lody-ios/kit';
import { useAuth } from '@/features/auth/AuthProvider';

export default function SettingsScreen() {
  const auth = useAuth(),
    router = useRouter();
  const sections: NativeListSection[] = [
    {
      id: 'account',
      header: '账号',
      footer: auth.error ?? undefined,
      rows: [
        {
          id: 'account',
          title: auth.account?.user.name ?? '欢迎使用 Lody',
          subtitle: auth.account?.user.email ?? '登录后连接你的工作区',
          image: 'person.crop.circle',
        },
      ],
    },
    {
      id: 'about',
      header: '关于',
      rows: [
        {
          id: 'about',
          title: 'Lody for iOS',
          subtitle: '随时查看项目，与电脑上的智能助手继续对话。',
          image: 'info.circle',
        },
      ],
    },
  ];
  if (auth.account && !auth.busy)
    sections[0].rows.push({
      id: 'auth-logout',
      title: '退出登录',
      image: 'rectangle.portrait.and.arrow.right',
      action: true,
      destructive: true,
    });
  if (__DEV__)
    sections.push({
      id: 'developer',
      header: '开发者',
      rows: [
        {
          id: 'debug-open',
          title: 'Debug',
          image: 'ladybug',
          action: true,
          disclosure: true,
          navigates: true,
        },
      ],
    });
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
