import { Stack } from 'expo-router';
import { useCatalog } from '@/cloud/CatalogProvider';
import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Pressable,
  Text,
  TextInput,
  View,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { usePalette } from '@/theme/palette';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MessageBubble, type Message } from './MessageBubble';
import { ScrollViewMarker } from 'react-native-screens/experimental';
import {
  addDataRuntimeListener,
  watchSession,
  unwatchSession,
  sendSessionTurn,
} from '@lody-ios/kit';
import { definePage, usePageRuntime } from '@/presentation';
import { useAuth } from '@/features/auth/AuthProvider';
import { softScrollEdgeEffects } from '@/ui/Screen';
import { Composer } from '@/ui/Composer';
import { AppText } from '@/ui/AppText';
import type { Session } from '@/cloud/model';

type SessionParams = { session: Session; initialDraft?: string };
type Snapshot = { status: string; reason?: string; messages: Message[] };
function SessionScreen() {
  const {
    params: { session, initialDraft },
  } = usePageRuntime<SessionParams>();
  const { account } = useAuth(),
    colors = usePalette();
  const insets = useSafeAreaInsets();
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
  const [snapshot, setSnapshot] = useState<Snapshot>({
    status: 'syncing',
    messages: [],
  });
  const [draft, setDraft] = useState(initialDraft ?? ''),
    [sending, setSending] = useState(false),
    [receipt, setReceipt] = useState('');
  const [showJump, setShowJump] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const viewportHeight = useRef(0),
    contentHeight = useRef(0);
  const list = useRef<FlatList<Message>>(null),
    following = useRef(true),
    busy = useRef(false),
    autoSent = useRef(false);
  useEffect(() => {
    const subscription = addDataRuntimeListener((event) => {
      if (event.sessionId === session.id && event.session) {
        try {
          const data = JSON.parse(event.session);
          if (Array.isArray(data.messages)) setSnapshot(data);
        } catch {
          setSnapshot((old) => ({ ...old, status: 'offline' }));
        }
      } else if (
        ['starting', 'background', 'failed', 'stopped'].includes(event.state)
      ) {
        setSnapshot((old) => ({ ...old, status: event.state }));
      }
    });
    void watchSession(session.id).catch(() =>
      setSnapshot((old) => ({ ...old, status: 'offline' })),
    );
    return () => {
      subscription.remove();
      void unwatchSession(session.id);
    };
  }, [session.id]);
  useEffect(() => {
    if (!following.current && snapshot.messages.length) setShowJump(true);
  }, [snapshot.messages]);
  useEffect(() => {
    if (autoSent.current || !initialDraft || snapshot.status !== 'live') return;
    autoSent.current = true;
    void submit();
    // Dispatch once when the new session first goes live; never replay on reconnect.
  }, [snapshot.status, initialDraft]);

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
    following.current = true;
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
    } catch (error) {
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
  const scrollToLatest = () => {
    following.current = true;
    setShowJump(false);
    list.current?.scrollToEnd({ animated: true });
  };
  return (
    <KeyboardAvoidingView
      behavior="padding"
      style={{ flex: 1, backgroundColor: colors.background }}
    >
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
      <ScrollViewMarker
        style={{ flex: 1 }}
        scrollEdgeEffects={softScrollEdgeEffects}
      >
        <FlatList
          ref={list}
          data={snapshot.messages}
          keyExtractor={(item) => item.id}
          contentInsetAdjustmentBehavior="automatic"
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingHorizontal: 22,
            paddingTop: 16,
            paddingBottom: 24,
            gap: 24,
          }}
          onScrollBeginDrag={() => {
            following.current = false;
          }}
          onScroll={({ nativeEvent: e }) => {
            if (!following.current) {
              const near =
                e.contentSize.height -
                  e.contentOffset.y -
                  e.layoutMeasurement.height <
                100;
              following.current = near;
              if (near) setShowJump(false);
            }
          }}
          scrollEventThrottle={100}
          onLayout={({ nativeEvent }) => {
            viewportHeight.current = nativeEvent.layout.height;
            if (
              following.current &&
              contentHeight.current > viewportHeight.current
            )
              requestAnimationFrame(() =>
                list.current?.scrollToEnd({ animated: false }),
              );
          }}
          onContentSizeChange={(_, height) => {
            contentHeight.current = height;
            if (
              following.current &&
              viewportHeight.current > 0 &&
              height > viewportHeight.current
            )
              requestAnimationFrame(() =>
                list.current?.scrollToEnd({ animated: false }),
              );
          }}
          ListEmptyComponent={
            <View
              style={{ paddingVertical: 60, alignItems: 'center', gap: 14 }}
            >
              {snapshot.status !== 'live' ? (
                <ActivityIndicator color={colors.accent} />
              ) : null}
              <Text
                style={{ color: colors.label, fontSize: 22, fontWeight: '600' }}
              >
                {snapshot.status === 'live'
                  ? '想继续做些什么？'
                  : '正在取回对话'}
              </Text>
              <Text
                style={{
                  color: colors.secondaryLabel,
                  textAlign: 'center',
                  lineHeight: 22,
                }}
              >
                消息会与电脑同步，随时接着聊。
              </Text>
            </View>
          }
          renderItem={({ item }) => <MessageBubble message={item} />}
        />
      </ScrollViewMarker>
      {showJump ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="回到最新消息"
          onPress={scrollToLatest}
          style={{
            alignSelf: 'center',
            paddingHorizontal: 18,
            paddingVertical: 12,
            borderRadius: 22,
            backgroundColor: colors.card,
            borderColor: colors.separator,
            borderWidth: 1,
            marginBottom: 8,
          }}
        >
          <Text style={{ color: colors.accent }}>↓ 最新消息</Text>
        </Pressable>
      ) : null}
      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 10,
          paddingBottom: Math.max(insets.bottom, 12),
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
            onPress={() => {
              void watchSession(session.id).catch(() =>
                setSnapshot((old) => ({ ...old, status: 'offline' })),
              );
            }}
            style={{ minHeight: 44, justifyContent: 'center' }}
          >
            <AppText variant="body" style={{ color: colors.accent }}>
              连接已暂停 · 点此重新同步
            </AppText>
          </Pressable>
        ) : null}
        <Composer
          testID="session-input"
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
    </KeyboardAvoidingView>
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
