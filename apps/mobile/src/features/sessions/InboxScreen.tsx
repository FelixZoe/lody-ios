import { Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { NativeGroupedList } from '@lody-ios/kit';
import { Screen } from '@/ui/Screen';
import { useAuth } from '@/features/auth/AuthProvider';
import { LoginPanel } from '@/features/auth/LoginPanel';
import { subscribeCatalog } from '@/cloud/runtime';
import { publishConnection } from '@/cloud/connection';
import type { Catalog } from '@/cloud/model';
import { usePalette } from '@/theme/palette';
import { listPlaceholder } from '@/ui/listState';
import { showToast } from '@/ui/toast';
import { present } from '@/presentation';
import { inboxSections } from './inbox';
import { createSessionPage } from './CreateSessionScreen';
import { sessionPage } from './SessionScreen';

const emptyCatalog: Catalog = { projects: [], sessions: [], machineIds: [] };

export default function InboxScreen() {
  const { account } = useAuth();
  const colors = usePalette();
  const [workspaceId, setWorkspaceId] = useState('');
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [connected, setConnected] = useState(true);
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const [query, setQuery] = useState('');
  const selected =
    account?.workspaces.find((w) => w.id === workspaceId) ??
    account?.workspaces[0];

  useEffect(() => {
    setCatalog(null);
    if (!account || !selected) {
      setLoading(false);
      return;
    }
    setLoading(true);
    return subscribeCatalog(selected.id, (event, data) => {
      const syncing = ['starting', 'syncing'].includes(event.state);
      const offline = ['offline', 'failed'].includes(event.state);
      setLoading(syncing);
      setConnected(!offline);
      if (data) setCatalog(data);
      publishConnection({
        state: offline ? 'offline' : syncing ? 'syncing' : 'live',
        machines: data?.machineIds.length ?? 0,
        syncedAt: data ? Date.now() : undefined,
      });
    });
  }, [account, selected?.id, revision]);

  const snapshot = catalog ?? emptyCatalog;
  const sections = useMemo(
    () => inboxSections(snapshot, { keyword: query, accent: colors.accent }),
    [snapshot, query, colors.accent],
  );

  async function open(id: string) {
    const session = snapshot.sessions.find((s) => s.id === id);
    if (!session) return;
    try {
      await present(sessionPage, { session });
    } catch {
      showToast('暂时无法打开会话，请重试。');
    }
  }

  async function create() {
    if (!selected) return;
    try {
      const result = await present(createSessionPage, {
        workspaceId: selected.id,
        projects: snapshot.projects,
      });
      if (result.status === 'completed')
        await present(sessionPage, {
          session: result.value.session,
          initialDraft: result.value.draft,
        });
    } catch {
      showToast('暂时无法新建会话，请重试。');
    }
  }

  if (!account)
    return (
      <Screen>
        <LoginPanel />
      </Screen>
    );

  return (
    <>
      <Stack.Screen
        options={{
          headerSearchBarOptions: {
            placeholder: '搜索会话或项目',
            onChangeText: ({ nativeEvent }) => setQuery(nativeEvent.text),
          },
        }}
      />
      {account.workspaces.length > 1 ? (
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Menu
            accessibilityLabel="切换工作区"
            icon="rectangle.stack"
            tintColor={colors.accent}
          >
            {account.workspaces.map((workspace) => (
              <Stack.Toolbar.MenuAction
                key={workspace.id}
                icon={workspace.id === selected?.id ? 'checkmark' : undefined}
                onPress={() => setWorkspaceId(workspace.id)}
              >
                {workspace.name}
              </Stack.Toolbar.MenuAction>
            ))}
          </Stack.Toolbar.Menu>
        </Stack.Toolbar>
      ) : null}
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          accessibilityLabel="新建会话"
          icon="plus"
          tintColor={colors.accent}
          onPress={() => void create()}
        />
      </Stack.Toolbar>
      <NativeGroupedList
        style={{ flex: 1 }}
        accent={colors.accent}
        sections={sections}
        refreshing={loading}
        placeholder={listPlaceholder({
          loading,
          filtered: query.trim().length > 0,
          connected,
        })}
        onRefresh={() => setRevision((n) => n + 1)}
        onRowPress={({ nativeEvent }) => void open(nativeEvent.id)}
      />
    </>
  );
}
