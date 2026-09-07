import { useState } from 'react';
import { PlatformColor, View } from 'react-native';
import { NativeCodeView } from '@lody-ios/kit';
import { definePage, usePageRuntime } from '@/presentation';
import { AppText } from '@/ui/AppText';

export type FileParams = { path: string; handle: string; bytes: number };

function FileScreen() {
  const { params } = usePageRuntime<FileParams>();
  const [error, setError] = useState('');
  return (
    <View
      style={{ flex: 1, backgroundColor: PlatformColor('systemBackground') }}
    >
      {error ? (
        <AppText variant="meta" style={{ padding: 24, textAlign: 'center' }}>
          {error}
        </AppText>
      ) : (
        <NativeCodeView
          style={{ flex: 1 }}
          path={params.path}
          handle={params.handle}
          onFail={({ nativeEvent }) =>
            setError(
              nativeEvent.message === 'content_expired'
                ? '内容已过期，请返回重新打开'
                : '渲染失败，请返回重试',
            )
          }
        />
      )}
    </View>
  );
}

export const filePage = definePage<FileParams>({
  id: 'file',
  title: '文件',
  Component: FileScreen,
  parseRouteParams: () => {
    throw new Error('请从项目文件打开');
  },
  presentation: { style: 'push', headerVariant: 'transparent' },
});
