import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { respondSessionPermission } from '@lody-ios/kit';
import { definePage, usePageRuntime } from '@/presentation';
import { usePalette } from '@/theme/palette';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { CommandBlock, type DetailResponse } from './DetailBlocks';
import { fetchDetail } from './itemDetailPage';

export type PermissionParams = {
  sessionId: string;
  entryId: string;
  itemId: string;
  requestId: string;
  generation: number;
  kind: string;
  title: string;
  path?: string;
};

const HEADINGS: Record<string, string> = {
  execute: '允许执行命令？',
  bash: '允许执行命令？',
  edit: '允许编辑文件？',
  write: '允许编辑文件？',
  delete: '允许编辑文件？',
  move: '允许编辑文件？',
};

function PermissionScreen() {
  const { params, finish } = usePageRuntime<PermissionParams, void>();
  const colors = usePalette();
  const [detail, setDetail] = useState<DetailResponse>();
  const [submitting, setSubmitting] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    void fetchDetail(params)
      .then(setDetail)
      .catch(() => setError('无法读取权限选项'));
  }, [params.sessionId, params.entryId, params.itemId]);

  const answer = async (optionId: string) => {
    setSubmitting(optionId);
    setError('');
    try {
      const result = JSON.parse(
        await respondSessionPermission(
          JSON.stringify({
            sessionId: params.sessionId,
            entryId: params.entryId,
            itemId: params.itemId,
            requestId: params.requestId,
            optionId,
          }),
        ),
      );
      if (result.state === 'accepted') finish();
      else
        setError(
          result.state === 'stale'
            ? '这个请求已经失效'
            : '已经在别处作答，以那次为准',
        );
    } catch (caught) {
      setError(
        String(caught).includes('invalid_option')
          ? '选项已失效'
          : '发送失败，请重试',
      );
    } finally {
      setSubmitting('');
    }
  };
  const command = detail?.blocks.find((b) => b.type === 'terminal_command');
  const options = detail?.options ?? [];
  return (
    <View style={{ padding: 16, gap: 16 }}>
      <AppText variant="title">
        {HEADINGS[params.kind] ?? '允许调用工具？'}
      </AppText>
      {params.title ? (
        <AppText variant="secondary">{params.title}</AppText>
      ) : null}
      {command ? (
        <CommandBlock block={command} />
      ) : params.path ? (
        <AppText variant="mono" selectable>
          {params.path}
        </AppText>
      ) : null}
      {!detail && !error ? <ActivityIndicator /> : null}
      {error ? (
        <AppText variant="meta" style={{ color: colors.danger }}>
          {error}
        </AppText>
      ) : null}
      <View style={{ gap: 8 }}>
        {options.map((option, index) => {
          const allow = option.kind.startsWith('allow');
          const filled =
            allow &&
            options.findIndex((o) => o.kind.startsWith('allow')) === index;
          return submitting === option.optionId ? (
            <View
              key={option.optionId}
              style={{ minHeight: 44, justifyContent: 'center' }}
            >
              <ActivityIndicator />
            </View>
          ) : (
            <Button
              key={option.optionId}
              label={option.name}
              variant={filled ? 'filled' : 'plain'}
              disabled={!!submitting}
              destructive={option.kind.startsWith('reject')}
              onPress={() => void answer(option.optionId)}
            />
          );
        })}
      </View>
    </View>
  );
}

export const permissionPage = definePage<PermissionParams, void>({
  id: 'session-permission',
  title: '权限请求',
  Component: PermissionScreen,
  parseRouteParams: () => {
    throw new Error('请从会话页打开');
  },
  presentation: {
    style: 'formSheet',
    sheetAllowedDetents: 'fitToContents',
    sheetGrabberVisible: true,
    dismissible: true,
    headerVariant: 'transparent',
  },
});
