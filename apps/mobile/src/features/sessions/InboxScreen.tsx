import { useConnection } from '@/cloud/connection';
import { Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  NativeGroupedList,
  initialInboxView,
  saveInboxView,
} from '@lody-ios/kit';
import { Screen } from '@/ui/Screen';
import { useAuth } from '@/features/auth/AuthProvider';
import { LoginPanel } from '@/features/auth/LoginPanel';
import { useCatalog } from '@/cloud/CatalogProvider';
import { usePalette } from '@/theme/palette';
import { listPlaceholder } from '@/ui/listState';
import { inboxSections, projectSections } from './inbox';
import { newSession, openCatalogRow } from './navigation';
import { definePage, present, usePageRuntime } from '@/presentation';
import { showToast } from '@/ui/toast';

export default function InboxScreen() {
  const { account, localReady } = useAuth();
  const colors = usePalette();
  const { catalog, selected, setWorkspaceId, loading, connected, refresh } =
    useCatalog();
  const [mode, setMode] = useState(initialInboxView);
  const sections = useMemo(
    () =>
      mode === 0
        ? projectSections(catalog, colors.accent)
        : inboxSections(catalog, { accent: colors.accent }),
    [mode, catalog, colors.accent],
  );
  if (!localReady) return <Screen />;
  if (!account)
    return (
      <Screen>
        <LoginPanel />
      </Screen>
    );
  return (
    <>
      <Stack.Screen
        options={{ title: selected?.name ?? '会话', headerTitle: '' }}
      />
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Menu
          accessibilityLabel={`切换工作区，${selected?.name ?? '工作区'}`}
          tintColor={colors.label}
          hidesSharedBackground
          style={{ fontSize: 17, fontWeight: '600' }}
        >
          <Stack.Toolbar.Label>{`${selected?.name ?? '工作区'} ▾`}</Stack.Toolbar.Label>
          {account.workspaces.map((workspace) => (
            <Stack.Toolbar.MenuAction
              key={workspace.id}
              isOn={workspace.id === selected?.id}
              onPress={() => setWorkspaceId(workspace.id)}
            >
              {workspace.name}
            </Stack.Toolbar.MenuAction>
          ))}
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          accessibilityLabel="首页设置"
          icon="slider.horizontal.3"
          tintColor={colors.accent}
          onPress={async () => {
            try {
              const result = await present(inboxSettingsPage, { mode });
              if (result.status === 'completed') {
                setMode(result.value);
                saveInboxView(result.value);
              }
            } catch {
              showToast('暂时无法打开首页设置，请重试。');
            }
          }}
        />
        <Stack.Toolbar.Button
          accessibilityLabel="新建会话"
          icon="plus"
          tintColor={colors.accent}
          onPress={() => {
            if (selected) void newSession(selected.id, catalog);
          }}
        />
      </Stack.Toolbar>
      <NativeGroupedList
        style={{ flex: 1 }}
        accent={colors.accent}
        sections={sections}
        refreshing={false}
        placeholder={listPlaceholder({ loading, connected })}
        onRefresh={refresh}
        contentStyle={mode === 0}
        onRowPress={({ nativeEvent: { id } }) => openCatalogRow(id, catalog)}
      />
    </>
  );
}

function InboxSettingsScreen() {
  const { params, finish } = usePageRuntime<{ mode: number }, number>();
  const colors = usePalette();
  const connection = useConnection();
  const { refresh } = useCatalog();
  return (
    <NativeGroupedList
      style={{ flex: 1 }}
      transparent
      accent={colors.accent}
      sections={[
        {
          id: 'view',
          header: '首页视图',
          rows: ['项目', '动态'].map((title, index) => ({
            id: String(index),
            title,
            image: params.mode === index ? 'checkmark' : undefined,
            action: true,
          })),
        },
        {
          id: 'sync',
          header: '同步',
          rows: [
            {
              id: 'sync',
              title:
                connection.state === 'offline'
                  ? '离线，点按重试'
                  : connection.state === 'syncing'
                    ? '正在同步'
                    : '已同步',
              subtitle: connection.syncedAt
                ? `上次同步：${new Date(connection.syncedAt).toLocaleString()}`
                : undefined,
              image: 'arrow.clockwise',
              action: true,
            },
          ],
        },
      ]}
      onRowPress={({ nativeEvent: { id } }) => {
        if (id === 'sync') refresh();
        else if (id === '0' || id === '1') finish(Number(id));
      }}
    />
  );
}

const inboxSettingsPage = definePage<{ mode: number }, number>({
  id: 'inbox-settings',
  title: '首页设置',
  Component: InboxSettingsScreen,
  parseRouteParams: () => {
    throw new Error('请从首页打开');
  },
  presentation: {
    style: 'formSheet',
    headerVariant:'transparent',
    sheetAllowedDetents: [0.5, 1],
    sheetGrabberVisible: true,
  },
});
