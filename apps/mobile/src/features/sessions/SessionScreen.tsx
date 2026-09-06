import { Stack } from 'expo-router';
import { useCatalog } from '@/cloud/CatalogProvider';
import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  InputAccessoryView,
  Pressable,
  Text,
  View,
  Alert,
} from 'react-native';
import { usePalette } from '@/theme/palette';
import { ScrollViewMarker } from 'react-native-screens/experimental';
import { sendSessionTurn } from '@lody-ios/kit';
import { definePage, present, usePageRuntime } from '@/presentation';
import { useAuth } from '@/features/auth/AuthProvider';
import { softScrollEdgeEffects } from '@/ui/Screen';
import { Composer } from '@/ui/Composer';
import { AppText } from '@/ui/AppText';
import type { Session } from '@/cloud/model';
import type { EntrySummary, ItemSummary } from './transcript/types';
import type { Row } from './transcript/aggregate';
import { Transcript } from './transcript/Transcript';
import { pendingPermission, useSessionRuntime } from './useSessionRuntime';
import { itemDetailPage } from './detail/itemDetailPage';
import { permissionPage } from './detail/permissionPage';

type SessionParams = {
  session: Session;
  initialDraft?: string;
  modelId?: string;
  modeId?: string;
};
const COMPOSER_ID = 'session-composer';

function SessionScreen() {
  const {
    params: { session, initialDraft, modelId, modeId },
  } = usePageRuntime<SessionParams>();
  const { account } = useAuth(),
    colors = usePalette();
  const { catalog } = useCatalog();
  const project = catalog.projects.find((p) => p.id === session.projectId);
  const currentSession =
    catalog.sessions.find((s) => s.id === session.id) ?? session;
  const showDetails = () =>
    Alert.alert(
      currentSession.title,
      [project?.name, project?.rootPath, `电脑：${currentSession.machineId}`]
        .filter(Boolean)
        .join('\n'),
    );
  const { snapshot, overflow, cursor, reconnect } = useSessionRuntime(
    session.id,
  );
  const [draft, setDraft] = useState(initialDraft ?? ''),
    [sending, setSending] = useState(false),
    [receipt, setReceipt] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const list = useRef<FlatList<any>>(null),
    busy = useRef(false),
    autoSent = useRef(false),
    answered = useRef(new Set<string>());

  const askPermission = (
    entry: EntrySummary,
    item: Extract<ItemSummary, { type: 'tool_call' }>,
  ) =>
    void present(permissionPage, {
      sessionId: session.id,
      entryId: entry.id,
      itemId: item.itemId,
      requestId: item.permission!.requestId,
      generation: cursor.current.generation,
      kind: item.kind,
      title: item.title,
      path: item.path,
    });

  useEffect(() => {
    if (!snapshot.awaitingUserSince) return;
    for (const entry of snapshot.entries) {
      const item = pendingPermission(entry);
      const requestId = item?.permission?.requestId;
      if (!item || !requestId || answered.current.has(requestId)) continue;
      answered.current.add(requestId);
      askPermission(entry, item);
      return;
    }
  }, [snapshot]);

  useEffect(() => {
    if (autoSent.current || !initialDraft || snapshot.status !== 'live') return;
    autoSent.current = true;
    void submit();
    // Dispatch once when the new session first goes live; never replay on reconnect.
  }, [snapshot.status, initialDraft]);

  const onActivityPress = (entryId: string, row: Row) => {
    if (row.kind !== 'activity') return;
    const entry = snapshot.entries.find((e) => e.id === entryId);
    const item = entry && pendingPermission(entry, row.pendingPermission);
    if (entry && item && row.pendingPermission) {
      askPermission(entry, item);
      return;
    }
    void present(itemDetailPage, {
      sessionId: session.id,
      entryId,
      itemIds: row.members,
      generation: cursor.current.generation,
    });
  };

  async function submit() {
    if (
      busy.current ||
      !account ||
      !draft.trim() ||
      snapshot.status !== 'live' ||
      currentSession.archived ||
      uncertain
    )
      return;
    busy.current = true;
    setSending(true);
    setReceipt('正在保存并通知机器…');
    try {
      const result = JSON.parse(
        await sendSessionTurn(
          JSON.stringify({
            sessionId: session.id,
            machineId: session.machineId,
            userId: account.user.id,
            text: draft,
            cliType: session.cliType,
            agentType: session.agentType,
            resume: session.resume,
            modelId,
            modeId,
          }),
        ),
      );
      if (result.state !== 'unknown') setDraft('');
      setUncertain(result.state !== 'accepted');
      setReceipt(
        result.state === 'accepted'
          ? '机器已接收'
          : `${result.state === 'uploaded' ? '消息已保存，正在等待电脑确认。' : '发送结果暂时无法确认，草稿已保留。'}请等待同步，不要重复发送。`,
      );
      list.current?.scrollToEnd({ animated: true });
    } catch {
      setUncertain(true);
      setReceipt('发送结果暂时无法确认，请等待同步，不要重复发送。');
    } finally {
      busy.current = false;
      setSending(false);
    }
  }
  const canSend =
    snapshot.status === 'live' &&
    !currentSession.archived &&
    !sending &&
    !uncertain &&
    !!draft.trim();
  const disconnected = ['offline', 'failed', 'stopped'].includes(
    snapshot.status,
  );
  const connection =
    snapshot.status === 'live'
      ? '已连接'
      : disconnected
        ? '连接已暂停'
        : '正在连接…';
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen
        options={{
          title: currentSession.title,
          headerTitle: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="查看会话详情"
              onPress={showDetails}
              style={{ minHeight: 44, justifyContent: 'center', maxWidth: 240 }}
            >
              <Text
                numberOfLines={1}
                style={{ color: colors.label, fontSize: 17, fontWeight: '600' }}
              >
                {currentSession.title}
              </Text>
            </Pressable>
          ),
        }}
      />
      {overflow ? (
        <AppText
          accessibilityLiveRegion="polite"
          variant="meta"
          style={{
            color: colors.warning,
            textAlign: 'center',
            paddingVertical: 6,
          }}
        >
          同步已停止 · 内容可能不是最新
        </AppText>
      ) : null}
      <ScrollViewMarker
        style={{ flex: 1 }}
        scrollEdgeEffects={softScrollEdgeEffects}
      >
        <Transcript
          entries={snapshot.entries}
          live={snapshot.status === 'live'}
          listRef={list}
          onActivityPress={onActivityPress}
        />
      </ScrollViewMarker>
      <InputAccessoryView nativeID={COMPOSER_ID}>
        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 10,
            paddingBottom: 12,
            gap: 10,
            backgroundColor: colors.background,
          }}
        >
          {uncertain ? (
            <AppText
              accessibilityLiveRegion="polite"
              variant="meta"
              style={{ color: colors.danger }}
            >
              {receipt}
            </AppText>
          ) : null}
          {disconnected ? (
            <Pressable
              accessibilityRole="button"
              onPress={reconnect}
              style={{ minHeight: 44, justifyContent: 'center' }}
            >
              <AppText variant="body" style={{ color: colors.accent }}>
                连接已暂停 · 点此重新同步
              </AppText>
            </Pressable>
          ) : null}
          <Composer
            testID="session-input"
            inputAccessoryViewID={COMPOSER_ID}
            placeholder={
              currentSession.archived ? '此会话已归档' : '给 Lody 发消息…'
            }
            value={draft}
            onChangeText={setDraft}
            onSubmit={() => void submit()}
            editable={!sending && !uncertain && !currentSession.archived}
            submitDisabled={!canSend}
            sending={sending}
          />
          {!disconnected &&
          !uncertain &&
          (sending || snapshot.status !== 'live') ? (
            <AppText
              accessibilityLiveRegion="polite"
              variant="meta"
              style={{ textAlign: 'center' }}
            >
              {sending ? '正在发送…' : connection}
            </AppText>
          ) : null}
        </View>
      </InputAccessoryView>
    </View>
  );
}
export const sessionPage = definePage<SessionParams>({
  id: 'session',
  title: '消息',
  Component: SessionScreen,
  parseRouteParams: () => {
    throw new Error('请从会话列表打开');
  },
  presentation: { style: 'push', headerVariant: 'transparent' },
});
