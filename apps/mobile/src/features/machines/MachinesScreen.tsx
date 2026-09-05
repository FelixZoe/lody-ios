import { ScrollViewMarker } from 'react-native-screens/experimental';
import { softScrollEdgeEffects, Screen } from '@/ui/Screen';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '@/features/auth/AuthProvider';
import { LoginPanel } from '@/features/auth/LoginPanel';
import { subscribeCatalog } from '@/cloud/runtime';
import type { Catalog } from '@/cloud/model';
import { usePalette } from '@/ui/theme';
import { present } from '@/presentation';
import { projectSessionsPage } from './ProjectSessionsScreen';
const emptyCatalog: Catalog = { projects: [], sessions: [], machineIds: [] };
export default function MachinesScreen() {
  const { account } = useAuth(),
    colors = usePalette();
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
  if (!account)
    return (
      <Screen>
        <LoginPanel />
      </Screen>
    );
  const snapshot = catalog ?? emptyCatalog;
  const projects = snapshot.projects.filter((p) =>
    `${p.name} ${p.rootPath}`
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase()),
  );
  return (
    <ScrollViewMarker
      scrollEdgeEffects={softScrollEdgeEffects}
      style={{ flex: 1 }}
    >
      <FlatList
        data={projects}
        keyExtractor={(p) => p.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentInsetAdjustmentBehavior="automatic"
        refreshing={loading}
        onRefresh={() => setRevision((n) => n + 1)}
        contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 32 }}
        ListHeaderComponent={
          <View style={{ gap: 18, marginBottom: 12 }}>
            <View style={{ gap: 8 }}>
              <Text
                style={{
                  color: colors.muted,
                  fontSize: 13,
                  fontWeight: '600',
                }}
              >
                你的工作空间
              </Text>
              {account.workspaces.map((w) => (
                <Pressable
                  key={w.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: w.id === selected?.id }}
                  onPress={() => setWorkspaceId(w.id)}
                  style={{ minHeight: 44, justifyContent: 'center' }}
                >
                  <Text
                    style={{
                      color: w.id === selected?.id ? colors.text : colors.muted,
                      fontSize: 24,
                      fontWeight: '600',
                    }}
                  >
                    {w.name}
                    {account.workspaces.length > 1 && w.id === selected?.id
                      ? ' ✓'
                      : ''}
                  </Text>
                </Pressable>
              ))}
              <Text
                style={{ color: colors.muted, fontSize: 15, lineHeight: 22 }}
              >
                {selected
                  ? '从一个项目开始，继续上次的对话。'
                  : '当前账号还没有工作区。'}
              </Text>
            </View>
            <TextInput
              testID="project-search"
              accessibilityLabel="搜索项目"
              value={query}
              onChangeText={setQuery}
              placeholder="搜索项目"
              placeholderTextColor={colors.muted}
              clearButtonMode="while-editing"
              style={{
                backgroundColor: colors.subtle,
                borderRadius: 14,
                paddingHorizontal: 16,
                paddingVertical: 13,
                color: colors.text,
                fontSize: 16,
              }}
            />
            {error ? (
              <Text
                accessibilityLiveRegion="polite"
                style={{ color: colors.notification, lineHeight: 21 }}
              >
                {error}
              </Text>
            ) : null}
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
                style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}
              >
                全部项目
              </Text>
              <Text style={{ color: colors.muted, fontSize: 13 }}>
                {snapshot.projects.length} 个项目 · {snapshot.sessions.length}{' '}
                个会话
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={{ paddingVertical: 40, alignItems: 'center', gap: 12 }}>
            {loading ? <ActivityIndicator color={colors.primary} /> : null}
            <Text style={{ color: colors.muted }}>
              {loading
                ? '正在载入你的项目…'
                : query
                  ? '没有匹配的项目'
                  : '项目会在连接电脑后出现在这里'}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const sessions = snapshot.sessions.filter(
            (s) => s.projectId === item.id,
          );
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.name}，${sessions.length} 个会话`}
              onPress={() =>
                void present(projectSessionsPage, {
                  project: item,
                  sessions,
                }).catch(() => setError('暂时无法打开项目，请重试。'))
              }
              style={({ pressed }) => ({
                backgroundColor: colors.card,
                borderRadius: 20,
                borderCurve: 'continuous',
                padding: 18,
                gap: 14,
                opacity: pressed ? 0.65 : 1,
              })}
            >
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}
              >
                <View
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 14,
                    backgroundColor: colors.subtle,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Text
                    accessible={false}
                    allowFontScaling={false}
                    style={{
                      fontSize: 22,
                      fontWeight: '600',
                      color: colors.primary,
                    }}
                  >
                    {item.name.slice(0, 1).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1, gap: 5 }}>
                  <Text
                    style={{
                      color: colors.text,
                      fontSize: 18,
                      fontWeight: '600',
                    }}
                  >
                    {item.name}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{ color: colors.muted, fontSize: 13 }}
                  >
                    {item.rootPath || '云端项目'}
                  </Text>
                </View>
                <Text style={{ color: colors.muted, fontSize: 24 }}>›</Text>
              </View>
              <View
                style={{
                  borderTopWidth: 1,
                  borderColor: colors.border,
                  paddingTop: 12,
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 8,
                  justifyContent: 'space-between',
                }}
              >
                <Text style={{ color: colors.muted, fontSize: 13 }}>
                  {sessions.length} 个会话
                </Text>
                <Text
                  numberOfLines={1}
                  style={{ color: colors.primary, fontSize: 13 }}
                >
                  打开项目 →
                </Text>
              </View>
            </Pressable>
          );
        }}
      />
    </ScrollViewMarker>
  );
}
