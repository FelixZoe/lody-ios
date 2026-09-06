import { memo, useMemo, useRef, useState, type RefObject } from 'react';
import { Clipboard, FlatList, Pressable, View } from 'react-native';
import { usePalette } from '@/theme/palette';
import { AppText } from '@/ui/AppText';
import { aggregate, type Row } from './aggregate';
import type { EntrySummary } from './types';
import { ActivityRow } from './ActivityRow';
import { AssistantProse } from './AssistantProse';
import { TurnHeader } from './TurnHeader';
import { UserBubble } from './UserBubble';

type Line =
  | { key: string; kind: 'header'; entry: EntrySummary }
  | { key: string; kind: 'bubble'; entry: EntrySummary; text: string }
  | { key: string; kind: 'row'; entryId: string; row: Row };

export function entryText(entry: EntrySummary) {
  return entry.items
    .filter((i) => i.type === 'text' && 'text' in i)
    .map((i) => ('text' in i ? i.text : ''))
    .join('\n\n')
    .trim();
}

function flatten(entries: EntrySummary[]): Line[] {
  return entries.flatMap((entry): Line[] =>
    entry.role === 'user'
      ? [
          {
            key: `${entry.id}:bubble`,
            kind: 'bubble',
            entry,
            text: entryText(entry),
          },
        ]
      : [
          { key: `${entry.id}:header`, kind: 'header', entry },
          ...aggregate(entry.items).map((row): Line => ({
            key: `${entry.id}:${row.itemId}`,
            kind: 'row',
            entryId: entry.id,
            row,
          })),
        ],
  );
}

function ThoughtRow({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((v) => !v)}
        style={{ minHeight: 44, justifyContent: 'center' }}
      >
        <AppText variant="meta">
          {expanded ? '收起思考过程' : '查看思考过程'}
        </AppText>
      </Pressable>
      {expanded ? (
        <AppText variant="secondary" selectable>
          {text.trim()}
        </AppText>
      ) : null}
    </View>
  );
}

const PLAN_MARK: Record<string, string> = {
  completed: '✓',
  in_progress: '›',
};

function RowView({
  row,
  onActivityPress,
}: {
  row: Row;
  onActivityPress: () => void;
}) {
  switch (row.kind) {
    case 'prose':
      return <AssistantProse text={row.text} />;
    case 'thought':
      return <ThoughtRow text={row.text} />;
    case 'plan':
      return (
        <View style={{ gap: 4 }}>
          {row.entries.map((entry, index) => (
            <AppText key={index} variant="meta">
              {PLAN_MARK[entry.status] ?? '○'} {entry.content}
            </AppText>
          ))}
        </View>
      );
    case 'task':
      return (
        <AppText variant="meta">
          子任务 · {row.label} · {row.status}
        </AppText>
      );
    case 'activity':
      return (
        <ActivityRow
          symbol={row.symbol}
          label={row.label}
          running={row.running}
          failed={row.failed}
          pendingPermission={row.pendingPermission}
          disabled={!row.hasDetail && !row.pendingPermission}
          onPress={onActivityPress}
        />
      );
  }
}

const LineView = memo(
  function LineView({
    line,
    onActivityPress,
  }: {
    line: Line;
    onActivityPress: (entryId: string, row: Row) => void;
  }) {
    switch (line.kind) {
      case 'bubble':
        return <UserBubble text={line.text} />;
      case 'header':
        return (
          <TurnHeader
            timestamp={line.entry.timestamp}
            startedAt={line.entry.startedAt}
            endedAt={line.entry.endedAt}
            permissionWaitMs={line.entry.permissionWaitMs}
            onCopy={() => Clipboard.setString(entryText(line.entry))}
          />
        );
      case 'row':
        return (
          <RowView
            row={line.row}
            onActivityPress={() => onActivityPress(line.entryId, line.row)}
          />
        );
    }
  },
  (a, b) =>
    a.line.key === b.line.key &&
    (a.line.kind === 'row' && b.line.kind === 'row'
      ? a.line.row.rev === b.line.row.rev
      : a.line.kind !== 'row' &&
        b.line.kind !== 'row' &&
        a.line.entry.rev === b.line.entry.rev),
);

function Skeleton() {
  const colors = usePalette();
  return (
    <View accessibilityLabel="正在取回对话" style={{ gap: 12, paddingTop: 8 }}>
      {(['70%', '90%', '40%'] as const).map((width) => (
        <View
          key={width}
          style={{
            width,
            height: 16,
            borderRadius: 8,
            backgroundColor: colors.fill,
          }}
        />
      ))}
    </View>
  );
}

function Empty() {
  return (
    <View style={{ paddingVertical: 60, alignItems: 'center', gap: 14 }}>
      <AppText variant="title">想继续做些什么？</AppText>
      <AppText variant="secondary" style={{ textAlign: 'center' }}>
        消息会与电脑同步，随时接着聊。
      </AppText>
    </View>
  );
}

export function Transcript({
  entries,
  live,
  listRef,
  onActivityPress,
}: {
  entries: EntrySummary[];
  live: boolean;
  listRef: RefObject<FlatList<Line> | null>;
  onActivityPress: (entryId: string, row: Row) => void;
}) {
  const lines = useMemo(() => flatten(entries), [entries]);
  const nearBottom = useRef(true);
  return (
    <FlatList
      ref={listRef}
      data={lines}
      keyExtractor={(line) => line.key}
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 24,
        gap: 16,
      }}
      maintainVisibleContentPosition={{ minIndexForVisible: 1 }}
      onScroll={({ nativeEvent: e }) => {
        nearBottom.current =
          e.contentSize.height -
            e.contentOffset.y -
            e.layoutMeasurement.height <
          120;
      }}
      scrollEventThrottle={100}
      onContentSizeChange={() => {
        if (nearBottom.current)
          requestAnimationFrame(() =>
            listRef.current?.scrollToEnd({ animated: false }),
          );
      }}
      ListEmptyComponent={live ? <Empty /> : <Skeleton />}
      renderItem={({ item }) => (
        <LineView line={item} onActivityPress={onActivityPress} />
      )}
    />
  );
}
