import { useState } from 'react';
import { ScrollViewMarker } from 'react-native-screens/experimental';
import { softScrollEdgeEffects } from '@/ui/Screen';
import { FlatList, Text, Pressable, View, TextInput } from 'react-native';
import { definePage, usePageRuntime, present } from '@/presentation';
import { usePalette, sessionStatus } from '@/ui/theme';
import type { Project, Session } from '@/cloud/model';
import { sessionPage } from './SessionScreen';
type Params = { project: Project; sessions: Session[] };
function ProjectSessionsScreen() {
  const { params } = usePageRuntime<Params>(),
    colors = usePalette();
  const [query, setQuery] = useState(''),
    [error, setError] = useState('');
  const sessions = params.sessions.filter((s) =>
    s.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  return (
    <ScrollViewMarker
      scrollEdgeEffects={softScrollEdgeEffects}
      style={{ flex: 1 }}
    >
      <FlatList
        data={sessions}
        keyExtractor={(s) => s.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 22, gap: 12 }}
        ListHeaderComponent={
          <View style={{ gap: 14, marginBottom: 12 }}>
            <Text
              style={{
                color: colors.text,
                fontSize: 30,
                fontWeight: '700',
              }}
            >
              {params.project.name}
            </Text>
            <Text style={{ color: colors.muted, lineHeight: 21 }}>
              每一段对话，都是工作的延续。
            </Text>
            <TextInput
              accessibilityLabel="搜索会话"
              placeholder="搜索会话"
              placeholderTextColor={colors.muted}
              value={query}
              onChangeText={setQuery}
              clearButtonMode="while-editing"
              style={{
                backgroundColor: colors.subtle,
                padding: 14,
                borderRadius: 14,
                color: colors.text,
                fontSize: 16,
              }}
            />
            {error ? (
              <Text style={{ color: colors.notification }}>{error}</Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <Text style={{ color: colors.muted, paddingVertical: 32 }}>
            {query
              ? '没有匹配的会话'
              : '还没有会话。在电脑上开始后，就能在这里继续。'}
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              void present(sessionPage, { session: item }).catch(() =>
                setError('暂时无法打开会话，请重试。'),
              )
            }
            style={({ pressed }) => ({
              padding: 20,
              borderRadius: 18,
              backgroundColor: colors.card,
              gap: 12,
              opacity: pressed ? 0.65 : 1,
            })}
          >
            <Text
              style={{
                color: colors.text,
                fontSize: 17,
                fontWeight: '600',
                lineHeight: 25,
              }}
            >
              {item.title}
            </Text>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 8,
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  color: colors.muted,
                  fontSize: 13,
                  backgroundColor: colors.subtle,
                  paddingHorizontal: 9,
                  paddingVertical: 5,
                  borderRadius: 8,
                }}
              >
                {item.archived ? '已归档' : sessionStatus(item.status)}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {Number.isNaN(Date.parse(item.createdAt))
                  ? ''
                  : new Date(item.createdAt).toLocaleDateString('zh-CN', {
                      month: 'short',
                      day: 'numeric',
                    })}
                　›
              </Text>
            </View>
          </Pressable>
        )}
      />
    </ScrollViewMarker>
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
