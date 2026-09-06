import { Stack } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { NativeGroupedList, type NativeListSection } from '@lody-ios/kit';
import { definePage, usePageRuntime, present } from '@/presentation';
import { sessionStatus, usePalette } from '@/ui/theme';
import type { Project, Session } from '@/cloud/model';
import { addDataRuntimeListener } from '@lody-ios/kit';
import { createSessionPage } from './CreateSessionScreen';
import { sessionPage } from './SessionScreen';

type Params = { workspaceId: string; project: Project; sessions: Session[] };

function sessionDate(value: string) {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed)
    ? ''
    : new Date(parsed).toLocaleDateString('zh-CN', {
        month: 'short',
        day: 'numeric',
      });
}

function ProjectSessionsScreen() {
  const { params } = usePageRuntime<Params>();
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const colors = usePalette();
  const opening = useRef(false);
  const [allSessions, setAllSessions] = useState(params.sessions);
  useEffect(() => {
    const subscription = addDataRuntimeListener((event) => {
      if (!event.catalog) return;
      try {
        const data = JSON.parse(event.catalog);
        if (Array.isArray(data.sessions))
          setAllSessions(
            data.sessions.filter(
              (s: Session) => s.projectId === params.project.id,
            ),
          );
      } catch {
        /* Keep the last complete catalog. */
      }
    });
    return () => subscription.remove();
  }, [params.project.id]);
  async function create() {
    if (opening.current) return;
    opening.current = true;
    try {
      const result = await present(createSessionPage, {
        workspaceId: params.workspaceId,
        project: params.project,
      });
      if (result.status === 'completed') {
        setAllSessions((old) => [
          result.value,
          ...old.filter((s) => s.id !== result.value.id),
        ]);
        await present(sessionPage, { session: result.value });
      }
    } catch {
      setError('暂时无法打开会话，请重试。');
    } finally {
      opening.current = false;
    }
  }
  const keyword = query.trim().toLocaleLowerCase();
  const sections = useMemo<NativeListSection[]>(
    () => [
      {
        id: 'sessions',
        header: keyword ? '搜索结果' : '会话',
        footer: error || params.project.rootPath,
        rows: allSessions
          .filter((s) => s.title.toLocaleLowerCase().includes(keyword))
          .map((session) => ({
            id: session.id,
            title: session.title,
            subtitle: `${
              session.archived ? '已归档' : sessionStatus(session.status)
            }　${sessionDate(session.createdAt)}`.trim(),
            image: 'bubble.left.and.text.bubble.right',
            action: true,
            disclosure: true,
            navigates: true,
          })),
      },
    ],
    [allSessions, params.project.rootPath, keyword, error],
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: params.project.name,
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="新建会话"
              onPress={() => void create()}
              style={{
                minWidth: 44,
                minHeight: 44,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Text style={{ color: colors.primary, fontSize: 28 }}>＋</Text>
            </Pressable>
          ),
          headerSearchBarOptions: {
            placeholder: '搜索会话',
            onChangeText: ({ nativeEvent }) => setQuery(nativeEvent.text),
          },
        }}
      />
      <NativeGroupedList
        style={{ flex: 1 }}
        sections={sections}
        placeholder={
          keyword ? '没有匹配的会话' : '还没有会话，点击「新建会话」开始。'
        }
        onRowPress={({ nativeEvent }) => {
          const session = allSessions.find((s) => s.id === nativeEvent.id);
          if (!session) return;
          void present(sessionPage, { session }).catch(() =>
            setError('暂时无法打开会话，请重试。'),
          );
        }}
      />
    </>
  );
}

export const projectSessionsPage = definePage<Params>({
  id: 'project-sessions',
  title: '会话',
  Component: ProjectSessionsScreen,
  parseRouteParams: () => {
    throw new Error('请从项目列表打开');
  },
  presentation: { style: 'push', headerVariant: 'transparent' },
});
