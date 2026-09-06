import { useEffect } from 'react';
import { Alert } from 'react-native';
import { NativeGroupedList } from '@lody-ios/kit';
import { definePage } from '@/presentation';
import { useAuth } from '@/features/auth/AuthProvider';
import { usePalette } from '@/theme/palette';
import { Stack, useRouter } from 'expo-router';
function AccountScreen() {
  const auth = useAuth();
  const colors = usePalette();
  const router = useRouter();
  useEffect(() => {
    if (!auth.account) router.replace('/');
  }, [auth.account, router]);
  return (
    <>
      <Stack.Screen options={{ title: '账号' }} />
      <NativeGroupedList
        style={{ flex: 1 }}
        accent={colors.accent}
        placeholder="尚未登录"
        sections={
          auth.account
            ? [
                {
                  id: 'account',
                  rows: [
                    {
                      id: 'name',
                      title: auth.account.user.name,
                      subtitle: auth.account.user.email,
                      image: 'person.crop.circle',
                    },
                  ],
                },
                {
                  id: 'logout',
                  footer: auth.error ?? undefined,
                  rows: [
                    {
                      id: 'logout',
                      title: auth.busy ? '正在退出…' : '退出登录',
                      destructive: true,
                      action: !auth.busy,
                    },
                  ],
                },
              ]
            : []
        }
        onRowPress={() =>
          Alert.alert('退出登录？', '退出后此设备将停止同步。', [
            { text: '取消', style: 'cancel' },
            {
              text: '退出登录',
              style: 'destructive',
              onPress: () => {
                void auth.logout();
              },
            },
          ])
        }
      />
    </>
  );
}
export const accountPage = definePage({
  id: 'account',
  title: '账号',
  Component: AccountScreen,
});
