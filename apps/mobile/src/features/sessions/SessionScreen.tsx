import { Stack } from 'expo-router';
import { useCatalog } from '@/cloud/CatalogProvider';
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Alert } from 'react-native';
import { usePalette } from '@/theme/palette';
import {
  NativeChat,
  type ChatDraftAttachment,
  sendSessionTurn,
  sessionCreationOptions,
} from '@lody-ios/kit';
import { definePage, present, usePageRuntime } from '@/presentation';
import { localProjectIdOf } from '@lody-ios/kit';
import { newSession, setArchived, setPinned } from './navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import type { Capability, CreationOptions, Session } from '@/cloud/model';
import type { EntrySummary, ItemSummary } from './transcript/types';
import { pendingPermission, useSessionRuntime } from './useSessionRuntime';
import { itemDetailPage } from './detail/itemDetailPage';
import { basename } from './changes/turnChangesPage';
import { fileDiffPage } from './changes/fileDiffPage';
import { filesPage } from './files/FilesScreen';
import { changedFiles } from './transcript/changes';
import { permissionPage } from './detail/permissionPage';
import { useProcessSheet } from './detail/processPage';
import type { ModelChoice } from './ModelScreen';

type SessionParams = {
  session: Session;
  initialDraft?: string;
  initialAttachments?: ChatDraftAttachment[];
  modelId?: string;
  effort?: string;
  modeId?: string;
};

function SessionScreen() {
  const {
    params: {
      session,
      initialDraft,
      initialAttachments,
      modelId,
      effort,
      modeId,
    },
  } = usePageRuntime<SessionParams>();
  const { account } = useAuth(),
    colors = usePalette();
  const { catalog, selected } = useCatalog();
  const project = catalog.projects.find((p) => p.id === session.projectId);
  const currentSession =
    catalog.sessions.find((s) => s.id === session.id) ?? session;
  const [capability, setCapability] = useState<Capability>();
  const [choice, setChoice] = useState<ModelChoice>({
    modelId,
    effort,
    modeId,
  });
  const choiceHydrated = useRef(
    modelId !== undefined || effort !== undefined || modeId !== undefined,
  );

  useEffect(() => {
    if (
      !selected?.id ||
      !project?.id ||
      !currentSession.cliType ||
      !currentSession.agentType
    ) {
      setCapability(undefined);
      return;
    }
    let active = true;
    void sessionCreationOptions(
      JSON.stringify({ workspaceId: selected.id, projectId: project.id }),
    )
      .then((raw) => {
        if (!active) return;
        const options: CreationOptions = JSON.parse(raw);
        setCapability(
          options.capabilities.find(
            (item) =>
              item.machineId === currentSession.machineId &&
              item.cliType === currentSession.cliType &&
              item.agentType === currentSession.agentType,
          ),
        );
      })
      .catch(() => {
        if (active) setCapability(undefined);
      });
    return () => {
      active = false;
    };
  }, [
    selected?.id,
    project?.id,
    currentSession.machineId,
    currentSession.cliType,
    currentSession.agentType,
  ]);
  const browsable =
    !!selected &&
    !currentSession.archived &&
    !!localProjectIdOf(session.projectId);
  const showDetails = () =>
    Alert.alert(
      currentSession.title,
      [project?.name, project?.rootPath, `电脑：${currentSession.machineId}`]
        .filter(Boolean)
        .join('\n'),
      browsable && account
        ? [
            {
              text: '项目文件',
              onPress: () =>
                void present(filesPage, {
                  workspaceId: selected.id,
                  sessionId: session.id,
                  userId: account.user.id,
                  path: '',
                  title: project?.name ?? '项目文件',
                }),
            },
            { text: '好', style: 'cancel' },
          ]
        : undefined,
    );
  const onTurnChangesPress = (entryId: string, path: string) => {
    const entry = snapshot.entries.find((e) => e.id === entryId);
    if (!entry) return;
    if (!changedFiles(entry).some((file) => file.path === path)) return;
    void present(
      fileDiffPage,
      { sessionId: session.id, entryId, path },
      { title: basename(path) },
    );
  };
  const { snapshot, overflow, cursor, reconnect } = useSessionRuntime(
    session.id,
    account?.user.id ?? '',
    selected?.id ?? '',
  );
  useEffect(() => {
    if (choiceHydrated.current || !snapshot.composer) return;
    choiceHydrated.current = true;
    setChoice(snapshot.composer);
  }, [snapshot.composer]);
  const activeChoice = choiceHydrated.current
    ? choice
    : (snapshot.composer ?? choice);
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

  const hasInitialDraft = !!initialDraft || !!initialAttachments?.length;
  useEffect(() => {
    if (autoSent.current || !hasInitialDraft || snapshot.status !== 'live')
      return;
    autoSent.current = true;
    void submit(initialDraft ?? '', initialAttachments);
    // Dispatch once when the new session first goes live; never replay on reconnect.
  }, [snapshot.status, initialDraft, initialAttachments, hasInitialDraft]);

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

  async function submit(
    draft: string,
    attachments: ChatDraftAttachment[] = [],
  ) {
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
            modelId: capability
              ? (activeChoice.modelId ?? null)
              : activeChoice.modelId,
            modeId: activeChoice.modeId,
            reasoningEffort: capability
              ? (activeChoice.effort ?? null)
              : activeChoice.effort,
            reasoningEffortConfigId: capability?.reasoningEffortConfigId,
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
    () =>
      JSON.stringify(
        snapshot.entries.map((entry) => ({
          ...entry,
          fileDiffs: changedFiles(entry),
        })),
      ),
    [snapshot.entries],
  );
  const openProcess = useProcessSheet(entriesJSON, onActivityPress);
  const composerJSON = JSON.stringify({
    editable:
      !sending &&
      !uncertain &&
      !currentSession.archived &&
      (!hasInitialDraft || autoSent.current),
    canSend,
    sending,
    notice: uncertain
      ? receipt
      : overflow
        ? '同步已停止 · 内容可能不是最新'
        : disconnected
          ? '连接已暂停 · 点此重新同步'
          : '',
    reconnect: disconnected || overflow,
    placeholder: currentSession.archived
      ? '此会话已归档'
      : !disconnected && !overflow && snapshot.status !== 'live'
        ? '正在连接，可先输入…'
        : '给 Lody 发消息…',
  });
  const efforts = activeChoice.modelId
    ? (capability?.reasoningEfforts[activeChoice.modelId] ?? [])
    : [];
  const composerOptionsJSON = JSON.stringify({
    modelId: activeChoice.modelId ?? '',
    effort: activeChoice.effort ?? '',
    models: (capability?.models ?? []).map((item) => ({
      id: item.id,
      title: item.name,
    })),
    efforts: efforts.map((id) => ({ id, title: id })),
  });
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen
        options={{
          title: currentSession.title,
        }}
      />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu icon="ellipsis.circle" accessibilityLabel="更多">
          <Stack.Toolbar.MenuAction
            icon="square.and.pencil"
            onPress={() => {
              if (selected)
                void newSession(selected.id, catalog, currentSession.projectId);
            }}
          >
            新建会话
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction
            icon={currentSession.pinned ? 'pin.slash' : 'pin'}
            onPress={() => {
              if (selected)
                void setPinned(
                  selected.id,
                  currentSession,
                  !currentSession.pinned,
                );
            }}
          >
            {currentSession.pinned ? '取消置顶' : '置顶'}
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction
            icon={currentSession.archived ? 'tray.and.arrow.up' : 'archivebox'}
            onPress={() => {
              if (selected)
                void setArchived(
                  selected.id,
                  currentSession,
                  !currentSession.archived,
                );
            }}
          >
            {currentSession.archived ? '取消归档' : '归档'}
          </Stack.Toolbar.MenuAction>
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>
      <NativeChat
        navigationTitle={currentSession.title}
        navigationSubtitle={project?.name ?? ''}
        onTitlePress={showDetails}
        style={{ flex: 1 }}
        attachmentContextJSON={JSON.stringify({
          workspaceId: selected?.id,
          sessionId: session.id,
        })}
        entriesJSON={entriesJSON}
        composerJSON={composerJSON}
        composerOptionsJSON={composerOptionsJSON}
        initialDraft={initialDraft}
        draftKey={
          account && selected
            ? `draft:${account.user.id}:${selected.id}:${session.id}`
            : ''
        }
        initialAttachmentsJSON={JSON.stringify(initialAttachments ?? [])}
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
        onTurnChangesPress={({ nativeEvent }) =>
          onTurnChangesPress(nativeEvent.entryId, nativeEvent.path)
        }
        onReconnect={reconnect}
        onComposerOptionChange={({ nativeEvent }) => {
          choiceHydrated.current = true;
          setChoice((current) => ({
            ...current,
            modelId: nativeEvent.modelId || undefined,
            effort: nativeEvent.effort || undefined,
          }));
        }}
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
