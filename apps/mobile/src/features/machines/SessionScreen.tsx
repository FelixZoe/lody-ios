import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Pressable,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from 'react-native';
import { usePalette } from '@/ui/theme';
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
import type { Session } from '@/cloud/model';
type Snapshot = { status: string; reason?: string; messages: Message[] };
function SessionScreen() {
  const {
    params: { session },
  } = usePageRuntime<{ session: Session }>();
  const { account } = useAuth(),
    colors = usePalette();
  const insets = useSafeAreaInsets();
  const [snapshot, setSnapshot] = useState<Snapshot>({
    status: 'syncing',
    messages: [],
  });
  const [draft, setDraft] = useState(''),
    [sending, setSending] = useState(false),
    [receipt, setReceipt] = useState('');
  const [showJump, setShowJump] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const list = useRef<FlatList<Message>>(null),
    following = useRef(true),
    busy = useRef(false);
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
  async function submit() {
    if (
      busy.current ||
      !account ||
      !draft.trim() ||
      snapshot.status !== 'live' ||
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
    !session.archived &&
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
              setShowJump(!near);
            }
          }}
          scrollEventThrottle={100}
          onLayout={() => {
            if (following.current)
              requestAnimationFrame(() =>
                list.current?.scrollToEnd({ animated: false }),
              );
          }}
          onContentSizeChange={() => {
            if (following.current)
              requestAnimationFrame(() =>
                list.current?.scrollToEnd({ animated: false }),
              );
          }}
          ListHeaderComponent={
            <View style={{ gap: 10, paddingVertical: 12, marginBottom: 12 }}>
              <Text
                style={{
                  color: colors.muted,
                  fontSize: 12,
                  fontWeight: '600',
                  letterSpacing: 1,
                }}
              >
                项目对话
              </Text>
              <Text
                style={{
                  color: colors.text,
                  fontSize: 24,
                  lineHeight: 32,
                  fontWeight: '600',
                }}
              >
                {session.title}
              </Text>
            </View>
          }
          ListEmptyComponent={
            <View
              style={{ paddingVertical: 60, alignItems: 'center', gap: 14 }}
            >
              {snapshot.status !== 'live' ? (
                <ActivityIndicator color={colors.primary} />
              ) : null}
              <Text
                style={{ color: colors.text, fontSize: 22, fontWeight: '600' }}
              >
                {snapshot.status === 'live'
                  ? '想继续做些什么？'
                  : '正在取回对话'}
              </Text>
              <Text
                style={{
                  color: colors.muted,
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
            borderColor: colors.border,
            borderWidth: 1,
            marginBottom: 8,
          }}
        >
          <Text style={{ color: colors.primary }}>↓ 最新消息</Text>
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
          <Text
            accessibilityLiveRegion="polite"
            style={{ color: colors.notification, fontSize: 13, lineHeight: 20 }}
          >
            {receipt}
          </Text>
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
            <Text style={{ color: colors.primary }}>
              连接已暂停 · 点此重新同步
            </Text>
          </Pressable>
        ) : null}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: 8,
            backgroundColor: colors.card,
            borderRadius: 26,
            borderCurve: 'continuous',
            borderColor: colors.border,
            borderWidth: 1,
            padding: 7,
          }}
        >
          <TextInput
            testID="session-input"
            accessibilityLabel="消息内容"
            placeholder={session.archived ? '此会话已归档' : '给 Lody 发消息…'}
            placeholderTextColor={colors.muted}
            multiline
            maxLength={32000}
            value={draft}
            onChangeText={setDraft}
            editable={!sending && !uncertain && !session.archived}
            style={{
              flex: 1,
              color: colors.text,
              fontSize: 16,
              lineHeight: 23,
              paddingHorizontal: 12,
              paddingTop: 11,
              paddingBottom: 11,
              minHeight: 44,
              maxHeight: 140,
            }}
          />
          <Pressable
            testID="session-send"
            accessibilityRole="button"
            accessibilityLabel="发送消息"
            accessibilityState={{ disabled: !canSend }}
            disabled={!canSend}
            onPress={() => void submit()}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: canSend ? colors.primary : colors.subtle,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {sending ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text
                style={{
                  color: canSend ? colors.onAccent : colors.muted,
                  fontSize: 26,
                  fontWeight: '500',
                }}
              >
                ↑
              </Text>
            )}
          </Pressable>
        </View>
        <Text
          accessibilityLiveRegion="polite"
          style={{ color: colors.muted, fontSize: 11, textAlign: 'center' }}
        >
          {sending ? '正在发送…' : connection} · 回复由连接的电脑生成
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}
export const sessionPage = definePage<{ session: Session }>({
  id: 'session',
  title: '消息',
  Component: SessionScreen,
  parseRouteParams: () => {
    throw new Error('请从会话列表打开');
  },
  presentation: { style: 'push', headerVariant: 'transparent' },
});
