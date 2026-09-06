import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput } from 'react-native';
import { createSession, sessionCreationOptions } from '@lody-ios/kit';
import { definePage, usePageRuntime } from '@/presentation';
import { useAuth } from '@/features/auth/AuthProvider';
import type { CreationOptions, Project, Session } from '@/cloud/model';
import { Screen } from '@/ui/Screen';
import { usePalette } from '@/ui/theme';

type Params = { workspaceId: string; project: Project };
function CreateSessionScreen() {
  const { params, finish } = usePageRuntime<Params, Session>();
  const { account } = useAuth();
  const colors = usePalette();
  const [options, setOptions] = useState<CreationOptions>();
  const [selected, setSelected] = useState('');
  const [title, setTitle] = useState('');
  const [branch, setBranch] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [revision, setRevision] = useState(0);
  const busy = useRef(false);
  const github = params.project.id.startsWith('github:');
  useEffect(() => {
    let active = true;
    setLoading(true);
    setOptions(undefined);
    setError('');
    void sessionCreationOptions(
      JSON.stringify({
        workspaceId: params.workspaceId,
        projectId: params.project.id,
      }),
    )
      .then((raw) => {
        if (!active) return;
        const value: CreationOptions = JSON.parse(raw);
        setOptions(value);
        setSelected(
          value.agents[0]
            ? `${value.agents[0].machineId}:${value.agents[0].id}`
            : '',
        );
      })
      .catch(() => {
        if (active) setError('暂时无法读取电脑配置，请确认连接后重试。');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [params.workspaceId, params.project.id, revision]);
  const agent = options?.agents.find(
    (a) => `${a.machineId}:${a.id}` === selected,
  );
  const canCreate =
    !!agent &&
    !!title.trim() &&
    (!github || !!branch.trim()) &&
    !!account &&
    !loading &&
    !sending &&
    !uncertain;
  async function submit() {
    if (busy.current || !canCreate || !options || !agent || !account) return;
    busy.current = true;
    setSending(true);
    setError('');
    try {
      const result = JSON.parse(
        await createSession(
          JSON.stringify({
            workspaceId: params.workspaceId,
            projectId: params.project.id,
            sessionId: options.sessionId,
            machineId: agent.machineId,
            agentConfigId: agent.id,
            userId: account.user.id,
            title,
            ...(github ? { branch } : {}),
          }),
        ),
      );
      if (result.state === 'created') finish(result.session);
      else if (result.state === 'rejected') {
        setError('尚未创建会话，请重新读取电脑配置后重试。');
        setOptions(undefined);
      } else {
        setUncertain(true);
        setError('创建结果暂时无法确认。请返回会话列表查看，不要重复创建。');
      }
    } catch {
      setUncertain(true);
      setError('创建结果暂时无法确认。请返回会话列表查看，不要重复创建。');
    } finally {
      busy.current = false;
      setSending(false);
    }
  }
  const field = {
    color: colors.text,
    backgroundColor: colors.subtle,
    padding: 14,
    borderRadius: 12,
    fontSize: 16,
  };
  return (
    <Screen>
      <Text style={{ color: colors.text, fontSize: 24, fontWeight: '600' }}>
        {params.project.name}
      </Text>
      <TextInput
        accessibilityLabel="会话名称"
        placeholder="会话名称"
        placeholderTextColor={colors.muted}
        value={title}
        onChangeText={setTitle}
        maxLength={200}
        editable={!sending && !uncertain}
        style={field}
      />
      {github ? (
        <TextInput
          accessibilityLabel="起始分支"
          placeholder="起始分支，例如 main"
          placeholderTextColor={colors.muted}
          value={branch}
          onChangeText={setBranch}
          maxLength={255}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!sending && !uncertain}
          style={field}
        />
      ) : null}
      <Text style={{ color: colors.muted }}>
        {github
          ? '选择电脑与助手，将从指定分支创建工作区。'
          : '选择项目所属电脑上的助手，使用现有项目目录。'}
      </Text>
      {loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        options?.agents.map((a) => {
          const key = `${a.machineId}:${a.id}`;
          return (
            <Pressable
              key={key}
              accessibilityRole="radio"
              accessibilityState={{
                checked: selected === key,
                disabled: sending || uncertain,
              }}
              disabled={sending || uncertain}
              onPress={() => setSelected(key)}
              style={{
                minHeight: 56,
                paddingVertical: 12,
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  color: selected === key ? colors.primary : colors.text,
                  fontSize: 17,
                }}
              >
                {selected === key ? '✓ ' : ''}
                {a.name}
              </Text>
              {github ? (
                <Text style={{ color: colors.muted }}>{a.machineName}</Text>
              ) : null}
            </Pressable>
          );
        })
      )}
      {!loading && options && !options.agents.length ? (
        <Text style={{ color: colors.muted }}>
          没有可用的助手配置，请先在电脑上添加。
        </Text>
      ) : null}
      <Text style={{ color: colors.muted }}>
        模型与运行模式使用助手默认设置，创建后即可发送第一条消息。
      </Text>
      {error ? (
        <Text accessibilityRole="alert" style={{ color: colors.notification }}>
          {error}
        </Text>
      ) : null}
      {!loading && !options ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setRevision((n) => n + 1)}
          style={{ minHeight: 44, justifyContent: 'center' }}
        >
          <Text style={{ color: colors.primary }}>重新读取配置</Text>
        </Pressable>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !canCreate }}
        disabled={!canCreate}
        onPress={() => void submit()}
        style={{
          minHeight: 50,
          borderRadius: 14,
          backgroundColor: canCreate ? colors.primary : colors.subtle,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            color: canCreate ? '#fff' : colors.muted,
            fontSize: 17,
            fontWeight: '600',
          }}
        >
          {sending ? '正在创建…' : '创建会话'}
        </Text>
      </Pressable>
    </Screen>
  );
}
export const createSessionPage = definePage<Params, Session>({
  id: 'create-session',
  title: '新建会话',
  Component: CreateSessionScreen,
  parseRouteParams: () => {
    throw new Error('请从项目列表打开');
  },
  presentation: { style: 'pageSheet', headerVariant: 'transparent' },
});
