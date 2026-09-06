import { Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  NativeGroupedList,
  NativeMenuButton,
  type NativeListSection,
} from '@lody-ios/kit';
import { Screen } from '@/ui/Screen';
import { useAuth } from '@/features/auth/AuthProvider';
import { LoginPanel } from '@/features/auth/LoginPanel';
import { subscribeCatalog } from '@/cloud/runtime';
import type { Catalog } from '@/cloud/model';
import { present } from '@/presentation';
import { projectSessionsPage } from './ProjectSessionsScreen';

const emptyCatalog: Catalog = { projects: [], sessions: [], machineIds: [] };

export default function MachinesScreen() {
  const { account } = useAuth();
  const [workspaceId, setWorkspaceId] = useState('');
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const [query, setQuery] = useState('');
  const selected =
    account?.workspaces.find((w) => w.id === workspaceId) ??
    account?.workspaces[0];

  useEffect(() => {
    setCatalog(null);
    setError(null);
    if (!account || !selected) {
      setLoading(false);
      return;
    }
    setLoading(true);
    return subscribeCatalog(selected.id, (event, data) => {
      setLoading(['starting', 'syncing'].includes(event.state));
      setError(
        ['offline', 'failed'].includes(event.state)
          ? '连接暂时中断，当前内容可能未更新。下拉即可重试。'
          : null,
      );
      if (data) setCatalog(data);
    });
  }, [account, selected?.id, revision]);

  const snapshot = catalog ?? emptyCatalog;
  const keyword = query.trim().toLocaleLowerCase();
  const sections = useMemo<NativeListSection[]>(() => {
    const projects = snapshot.projects.filter((p) =>
      `${p.name} ${p.rootPath}`.toLocaleLowerCase().includes(keyword),
    );
    return [
      {
        id: 'projects',
        header: keyword ? '搜索结果' : '全部项目',
        footer: error ?? undefined,
        rows: projects.map((project) => ({
          id: project.id,
          title: project.name,
          subtitle: project.rootPath || '云端项目',
          value: String(
            snapshot.sessions.filter((s) => s.projectId === project.id).length,
          ),
          image: 'folder',
          action: true,
          disclosure: true,
          navigates: true,
        })),
      },
    ];
  }, [snapshot, keyword, error]);

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
          title: selected?.name ?? '项目',
          headerRight:
            account.workspaces.length > 1
              ? () => (
                  <NativeMenuButton
                    accessibilityName="切换工作区"
                    label={selected?.name ?? '选择工作区'}
                    items={account.workspaces.map((w) => ({
                      id: w.id,
                      title: w.name,
                      selected: w.id === selected?.id,
                    }))}
                    onSelect={setWorkspaceId}
                    style={{ height: 44 }}
                  />
                )
              : undefined,
          headerSearchBarOptions: {
            placeholder: '搜索项目',
            onChangeText: ({ nativeEvent }) => setQuery(nativeEvent.text),
          },
        }}
      />
      <NativeGroupedList
        style={{ flex: 1 }}
        sections={sections}
        refreshing={loading}
        placeholder={
          loading
            ? '正在载入你的项目…'
            : keyword
              ? '没有匹配的项目'
              : '项目会在连接电脑后出现在这里'
        }
        onRefresh={() => setRevision((n) => n + 1)}
        onRowPress={({ nativeEvent }) => {
          const project = snapshot.projects.find(
            (p) => p.id === nativeEvent.id,
          );
          if (!project) return;
          void present(projectSessionsPage, {
            workspaceId: selected!.id,
            project,
            sessions: snapshot.sessions.filter(
              (s) => s.projectId === project.id,
            ),
          }).catch(() => setError('暂时无法打开项目，请重试。'));
        }}
      />
    </>
  );
}
