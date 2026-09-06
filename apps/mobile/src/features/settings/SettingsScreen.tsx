import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { NativeGroupedList, type NativeListSection } from '@lody-ios/kit';
import { useAuth } from '@/features/auth/AuthProvider';
import { useCatalog } from '@/cloud/CatalogProvider';
import { useConnection } from '@/cloud/connection';
import { usePalette } from '@/theme/palette';
import { relativeTime } from '@/ui/time';
import { showToast } from '@/ui/toast';

const connectionRow = {
  live: { symbol: 'circle.fill', label: '已连接' },
  syncing: { symbol: 'circle', label: '正在同步' },
  offline: { symbol: 'xmark.octagon.fill', label: '连接已中断' },
} as const;

export default function SettingsScreen() {
  const auth = useAuth();
  const router = useRouter();
  const colors = usePalette();
  const connection = useConnection();
  const { refresh } = useCatalog();
  const shape = connectionRow[connection.state];
  const synced = connection.syncedAt
    ? relativeTime(new Date(connection.syncedAt).toISOString())
    : '';

  const sections: NativeListSection[] = [
    {
      id: 'account',
      header: '账号',
      rows: [
        {
          id: 'account',
          title: auth.account?.user.name ?? '欢迎使用 Lody',
          subtitle: auth.account?.user.email ?? '登录后连接你的工作区',
          image: 'person.crop.circle',
          action: true,
          disclosure: true,
          navigates: true,
        },
      ],
    },
    {
      id: 'connection',
      header: '连接',
      rows: [
        {
          id: 'connection',
          title: `${connection.machines} 台电脑`,
          subtitle: [
            shape.label,
            connection.state === 'offline'
              ? '点按重新同步'
              : synced && `同步于 ${synced}`,
          ]
            .filter(Boolean)
            .join(' · '),
          image: shape.symbol,
          action: connection.state === 'offline',
          imageTint:
            connection.state === 'live'
              ? colors.accent
              : connection.state === 'offline'
                ? 'danger'
                : 'secondary',
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
          subtitle: `${Constants.expoConfig?.version ?? '0.0.0'} (${
            Constants.expoConfig?.ios?.buildNumber ?? '1'
          })`,
          image: 'info.circle',
        },
      ],
    },
  ];

  if (__DEV__)
    sections.push({
      id: 'developer',
      header: '开发者',
      footer: '仅开发构建显示。',
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
      accent={colors.accent}
      sections={sections}
      placeholder=""
      onRowPress={({ nativeEvent }) => {
        if (nativeEvent.id === 'debug-open') router.push('/debug');
        if (nativeEvent.id === 'account')
          router.push(auth.account ? '/settings/account' : '/');
        if (nativeEvent.id === 'connection') refresh();
      }}
    />
  );
}
