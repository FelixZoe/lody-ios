import { Stack } from 'expo-router';
import { useCatalog } from '@/cloud/CatalogProvider';
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Alert } from 'react-native';
import { usePalette } from '@/theme/palette';
import { NativeChat, sendSessionTurn } from '@lody-ios/kit';
import { definePage, present, usePageRuntime } from '@/presentation';
import { useAuth } from '@/features/auth/AuthProvider';
import type { Session } from '@/cloud/model';
import type { EntrySummary, ItemSummary } from './transcript/types';
import { pendingPermission, useSessionRuntime } from './useSessionRuntime';
import { itemDetailPage } from './detail/itemDetailPage';
import { permissionPage } from './detail/permissionPage';
import { useProcessSheet } from './detail/processPage';

type Attachments = Parameters<
  NonNullable<React.ComponentProps<typeof NativeChat>['onSend']>
>[0]['nativeEvent']['attachments'];

type SessionParams = {
  session: Session;
  initialDraft?: string;
  modelId?: string;
  modeId?: string;
};

function SessionScreen() {
  const {
    params: { session, initialDraft, modelId, modeId },
  } = usePageRuntime<SessionParams>();
  const { account } = useAuth(),
    colors = usePalette();
  const { catalog, selected } = useCatalog();
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
    account?.user.id ?? '',
    selected?.id ?? '',
  );
  const [clearDraftToken, setClearDraftToken] = useState(0),
    [restoreDraftToken, setRestoreDraftToken] = useState(0),
    [sending, setSending] = useState(false),
    [receipt, setReceipt] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const busy = useRef(false),
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
    if (snapshot.status !== 'live' || !snapshot.awaitingUserSince) return;
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
    void submit(initialDraft);
    // Dispatch once when the new session first goes live; never replay on reconnect.
  }, [snapshot.status, initialDraft]);

  const onActivityPress = (entryId: string, itemId: string) => {
    if (snapshot.status !== 'live') {
      Alert.alert('正在同步', '对话已保存在本地，详细活动将在连接恢复后可用。');
      return;
    }
    const entry = snapshot.entries.find((e) => e.id === entryId);
    const item = entry?.items.find((i) => i.itemId === itemId);
    if (!entry || !item) return;
    if (
      entry &&
      item?.type === 'tool_call' &&
      'permission' in item &&
      item.permission?.pending
    ) {
      askPermission(entry, item as Extract<ItemSummary, { type: 'tool_call' }>);
      return;
    }
    void present(itemDetailPage, {
      sessionId: session.id,
      entryId,
      itemIds: [itemId],
      generation: cursor.current.generation,
    });
  };

  async function submit(draft: string, attachments: Attachments = []) {
    if (busy.current) return;
    if (
      !account ||
      (!draft.trim() && !attachments.length) ||
      snapshot.status !== 'live' ||
      currentSession.archived ||
      overflow ||
      uncertain
    ) {
      setRestoreDraftToken((token) => token + 1);
      return;
    }
    busy.current = true;
    setSending(true);

    try {
      const result = JSON.parse(
        await sendSessionTurn(
          JSON.stringify({
            sessionId: session.id,
            machineId: session.machineId,
            userId: account.user.id,
            text: draft,
            attachments,
            cliType: session.cliType,
            agentType: session.agentType,
            resume: session.resume,
            modelId,
            modeId,
          }),
        ),
      );
      if (result.state === 'not_sent') {
        setRestoreDraftToken((token) => token + 1);
        setReceipt(result.reason || '附件上传失败，请重试');
        Alert.alert('消息尚未发送', result.reason || '附件上传失败，请重试');
        return;
      }
      if (result.state !== 'unknown') setClearDraftToken((token) => token + 1);
      else setRestoreDraftToken((token) => token + 1);
      setUncertain(result.state !== 'accepted');
      setReceipt(
        result.state === 'accepted'
          ? '机器已接收'
          : `${result.state === 'uploaded' ? '消息已保存，正在等待电脑确认。' : '发送结果暂时无法确认，草稿已保留。'}请等待同步，不要重复发送。`,
      );
    } catch {
      setRestoreDraftToken((token) => token + 1);
      setUncertain(true);
      setReceipt('发送结果暂时无法确认，请等待同步，不要重复发送。');
    } finally {
      busy.current = false;
      setSending(false);
    }
  }
  const canSend =
    !!account &&
    !overflow &&
    snapshot.status === 'live' &&
    !currentSession.archived &&
    !sending &&
    !uncertain;
  const disconnected = ['offline', 'failed', 'stopped'].includes(
    snapshot.status,
  );
  const entriesJSON = useMemo(
    () => JSON.stringify(snapshot.entries),
    [snapshot.entries],
  );
  const openProcess = useProcessSheet(entriesJSON, onActivityPress);
  const composerJSON = JSON.stringify({
    editable:
      !sending &&
      !uncertain &&
      !currentSession.archived &&
      (!initialDraft || autoSent.current),
    canSend,
    sending,
    notice: uncertain
      ? receipt
      : overflow
        ? '同步已停止 · 内容可能不是最新'
        : disconnected
          ? '连接已暂停 · 点此重新同步'
          : snapshot.status !== 'live'
            ? '正在连接…'
            : '',
    reconnect: disconnected || overflow,
    placeholder: currentSession.archived ? '此会话已归档' : '给 Lody 发消息…',
  });
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen
        options={{
          title: currentSession.title,
        }}
      />
      <NativeChat
        navigationTitle={currentSession.title}
        onTitlePress={showDetails}
        style={{ flex: 1 }}
        attachmentContextJSON={JSON.stringify({
          workspaceId: selected?.id,
          sessionId: session.id,
        })}
        entriesJSON={entriesJSON}
        composerJSON={composerJSON}
        initialDraft={initialDraft}
        clearDraftToken={clearDraftToken}
        restoreDraftToken={restoreDraftToken}
        emptyText={
          snapshot.status === 'live'
            ? '想继续做些什么？\n消息会与电脑同步，随时接着聊。'
            : '正在取回对话…'
        }
        onSend={({ nativeEvent }) =>
          void submit(nativeEvent.text, nativeEvent.attachments)
        }
        onActivityPress={({ nativeEvent }) =>
          nativeEvent.itemId
            ? onActivityPress(nativeEvent.entryId, nativeEvent.itemId)
            : openProcess(nativeEvent.entryId, nativeEvent.processStartId)
        }
        onReconnect={reconnect}
      />
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
