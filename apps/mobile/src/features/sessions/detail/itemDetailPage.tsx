import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { addDataRuntimeListener, sessionItemDetail } from '@lody-ios/kit';
import { definePage, usePageRuntime } from '@/presentation';
import { usePalette } from '@/theme/palette';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Screen } from '@/ui/Screen';
import type { Envelope } from '../transcript/types';
import { Blocks, RawBlock, type DetailResponse } from './DetailBlocks';

export type ItemDetailParams = {
  sessionId: string;
  entryId: string;
  itemIds: string[];
  generation: number;
};

export async function fetchDetail(
  params: Omit<ItemDetailParams, 'itemIds' | 'generation'> & {
    itemId: string;
    cursor?: string;
  },
): Promise<DetailResponse> {
  return JSON.parse(await sessionItemDetail(JSON.stringify(params)));
}

function ItemDetailScreen() {
  const { params } = usePageRuntime<ItemDetailParams>();
  const colors = usePalette();
  const [details, setDetails] = useState<Record<string, DetailResponse>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const generation = useRef(params.generation);
  const waiting = useRef(false);

  const load = async (itemId: string, cursor?: string) => {
    const at = generation.current;
    try {
      const page = await fetchDetail({
        sessionId: params.sessionId,
        entryId: params.entryId,
        itemId,
        cursor,
      });
      if (at !== generation.current) return;
      setDetails((old) => ({
        ...old,
        [itemId]: cursor
          ? {
              ...page,
              blocks: [...(old[itemId]?.blocks ?? []), ...page.blocks],
            }
          : page,
      }));
      setError('');
    } catch {
      if (at === generation.current) setError('取回详情失败');
    } finally {
      if (at === generation.current) setLoading(false);
    }
  };
  const loadAll = () => {
    setLoading(true);
    for (const itemId of params.itemIds) void load(itemId);
  };

  useEffect(() => {
    loadAll();
    const subscription = addDataRuntimeListener((event) => {
      if (event.sessionId !== params.sessionId || !event.session) return;
      if (event.generation !== generation.current) {
        generation.current = event.generation;
        setDetails({});
        setError('');
        setLoading(true);
        waiting.current = true;
      }
      let data: Envelope;
      try {
        data = JSON.parse(event.session);
      } catch {
        return;
      }
      if (data.v !== 1 || !Array.isArray(data.entries)) return;
      if (waiting.current) {
        if (data.status !== 'live') return;
        waiting.current = false;
        loadAll();
        return;
      }
      const entry = data.entries.find((e) => e.id === params.entryId);
      for (const item of entry?.items ?? [])
        if (
          params.itemIds.includes(item.itemId) &&
          details[item.itemId] &&
          details[item.itemId].rev !== item.rev
        )
          void load(item.itemId);
    });
    return () => subscription.remove();
  }, [params.sessionId, params.entryId]);

  return (
    <Screen>
      {loading && !Object.keys(details).length ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : null}
      {params.itemIds.map((itemId) => {
        const detail = details[itemId];
        if (!detail) return null;
        return (
          <View key={itemId} style={{ gap: 12 }}>
            <Blocks blocks={detail.blocks} />
            <RawBlock title="原始输入" value={detail.rawInput} />
            <RawBlock title="原始输出" value={detail.rawOutput} />
            {detail.truncated ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <AppText variant="meta">内容已截断</AppText>
                <Button
                  label="继续加载"
                  onPress={() => void load(itemId, detail.nextCursor)}
                />
              </View>
            ) : null}
          </View>
        );
      })}
      {error ? (
        <View style={{ gap: 8, alignItems: 'center' }}>
          <AppText variant="meta" style={{ color: colors.danger }}>
            {error}
          </AppText>
          <Button label="重试" onPress={loadAll} />
        </View>
      ) : null}
    </Screen>
  );
}

export const itemDetailPage = definePage<ItemDetailParams>({
  id: 'session-item-detail',
  title: '详情',
  Component: ItemDetailScreen,
  parseRouteParams: () => {
    throw new Error('请从会话页打开');
  },
  presentation: {
    style: 'formSheet',
    sheetAllowedDetents: [0.6, 1],
    sheetInitialDetentIndex: 0,
    sheetGrabberVisible: true,
    headerVariant: 'transparent',
  },
});
