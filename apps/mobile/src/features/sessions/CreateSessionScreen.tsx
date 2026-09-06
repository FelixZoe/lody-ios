import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, TextInput, View } from 'react-native';
import {
  NativeGroupedList,
  type NativeListSection,
  createSession,
  sessionCreationOptions,
} from '@lody-ios/kit';
import { definePage, present, usePageRuntime } from '@/presentation';
import { useAuth } from '@/features/auth/AuthProvider';
import type { CreationOptions, Project, Session } from '@/cloud/model';
import { usePalette } from '@/theme/palette';
import { type as typeScale } from '@/theme/tokens';
import { AppText } from '@/ui/AppText';
import { Composer } from '@/ui/Composer';
import { showToast } from '@/ui/toast';
import { draftTitle } from './draftTitle';
import { pickerPage } from './PickerScreen';

type Params = { workspaceId: string; projects: Project[] };

/** Unassigned projects carry no working directory, so no session can start there. */
const creatable = (project: Project) => !project.id.endsWith(':unassigned');
export type CreatedSession = { session: Session; draft: string };

function CreateSessionScreen() {
  const { params, finish } = usePageRuntime<Params, CreatedSession>();
  const { account } = useAuth();
  const colors = usePalette();
  const projects = params.projects.filter(creatable);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '');
  const [options, setOptions] = useState<CreationOptions>();
  const [agentKey, setAgentKey] = useState('');
  const [branch, setBranch] = useState('');
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [revision, setRevision] = useState(0);
  const busy = useRef(false);

  const project = projects.find((p) => p.id === projectId);
  const github = projectId.startsWith('github:');

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setOptions(undefined);
    void sessionCreationOptions(
      JSON.stringify({ workspaceId: params.workspaceId, projectId }),
    )
      .then((raw) => {
        if (!active) return;
        const value: CreationOptions = JSON.parse(raw);
        setOptions(value);
        const first = value.agents[0];
        setAgentKey(first ? `${first.machineId}:${first.id}` : '');
      })
      .catch(() => {
        if (active) showToast('暂时无法读取电脑配置，请确认连接后重试。');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [params.workspaceId, projectId, revision]);

  const agent = options?.agents.find(
    (a) => `${a.machineId}:${a.id}` === agentKey,
  );

  async function pickProject() {
    const result = await present(pickerPage, {
      title: '选择项目',
      header: '项目',
      selectedId: projectId,
      options: projects.map((p) => ({
        id: p.id,
        title: p.name,
        subtitle: p.rootPath || '云端项目',
        subtitleMono: !!p.rootPath,
      })),
      placeholder: '还没有项目，先在电脑上打开一个。',
    });
    if (result.status === 'completed') setProjectId(result.value);
  }

  async function pickAgent() {
    if (!options) {
      setRevision((n) => n + 1);
      return;
    }
    const result = await present(pickerPage, {
      title: '选择助手',
      header: '助手',
      selectedId: agentKey,
      options: options.agents.map((a) => ({
        id: `${a.machineId}:${a.id}`,
        title: a.name,
        subtitle: a.machineName,
      })),
      placeholder: '没有可用的助手配置，请先在电脑上添加。',
    });
    if (result.status === 'completed') setAgentKey(result.value);
  }

  async function submit() {
    const ready =
      !!agent && !!options && !!account && !!draft.trim() && !uncertain;
    if (busy.current || !ready) return;
    if (github && !branch.trim()) {
      showToast('GitHub 项目需要填写起始分支。');
      return;
    }
    busy.current = true;
    setSending(true);
    try {
      const result = JSON.parse(
        await createSession(
          JSON.stringify({
            workspaceId: params.workspaceId,
            projectId,
            sessionId: options!.sessionId,
            machineId: agent!.machineId,
            agentConfigId: agent!.id,
            userId: account!.user.id,
            title: draftTitle(draft),
            ...(github ? { branch: branch.trim() } : {}),
          }),
        ),
      );
      if (result.state === 'created') {
        finish({ session: result.session, draft });
        return;
      }
      if (result.state === 'rejected') {
        showToast('尚未创建会话，请重新读取电脑配置后重试。');
        setRevision((n) => n + 1);
      } else {
        setUncertain(true);
        showToast('创建结果暂时无法确认。请回到会话列表查看，不要重复创建。');
      }
    } catch {
      setUncertain(true);
      showToast('创建结果暂时无法确认。请回到会话列表查看，不要重复创建。');
    } finally {
      busy.current = false;
      setSending(false);
    }
  }

  const sections: NativeListSection[] = [
    {
      id: 'project',
      header: '项目',
      rows: [
        {
          id: 'project',
          title: project?.name ?? '选择项目',
          subtitle: project?.rootPath || (project ? '云端项目' : undefined),
          subtitleMono: !!project?.rootPath,
          image: 'folder',
          action: true,
          disclosure: true,
        },
      ],
    },
    {
      id: 'agent',
      header: '助手',
      footer: loading
        ? '正在读取电脑配置…'
        : agent
          ? '模型与运行模式使用助手默认值。'
          : '点按重新读取电脑配置。',
      rows: [
        {
          id: 'agent',
          title: agent?.name ?? (loading ? '读取中…' : '选择助手'),
          subtitle: agent?.machineName,
          image: 'desktopcomputer',
          action: true,
          disclosure: true,
        },
      ],
    },
  ];

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
      <NativeGroupedList
        style={{ flex: 1 }}
        accent={colors.accent}
        transparent
        sections={sections}
        placeholder=""
        onRowPress={({ nativeEvent }) => {
          if (nativeEvent.id === 'project') void pickProject();
          if (nativeEvent.id === 'agent') void pickAgent();
        }}
      />
      {github ? (
        <View style={{ paddingHorizontal: 16, paddingBottom: 12, gap: 4 }}>
          <AppText variant="meta">起始分支</AppText>
          <TextInput
            accessibilityLabel="起始分支"
            placeholder="例如 main"
            placeholderTextColor={colors.tertiaryLabel}
            value={branch}
            onChangeText={setBranch}
            maxLength={255}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!sending && !uncertain}
            style={{
              color: colors.label,
              backgroundColor: colors.card,
              borderRadius: 10,
              borderCurve: 'continuous',
              paddingHorizontal: 14,
              minHeight: 44,
              fontFamily: 'Menlo',
              fontSize: typeScale.mono.size,
            }}
          />
        </View>
      ) : null}
      <View style={{ paddingHorizontal: 16, paddingBottom: 12, gap: 8 }}>
        <Composer
          testID="create-session-input"
          placeholder="描述你要做什么…"
          value={draft}
          onChangeText={setDraft}
          onSubmit={() => void submit()}
          editable={!!agent && !uncertain}
          sending={sending}
        />
        <AppText variant="meta" style={{ textAlign: 'center' }}>
          发送即创建会话，标题取自第一条消息。
        </AppText>
      </View>
    </KeyboardAvoidingView>
  );
}

export const createSessionPage = definePage<Params, CreatedSession>({
  id: 'create-session',
  title: '新建会话',
  Component: CreateSessionScreen,
  parseRouteParams: () => {
    throw new Error('请从会话列表打开');
  },
  presentation: {
    style: 'formSheet',
    headerVariant: 'transparent',
    sheetAllowedDetents: [0.62, 1],
    sheetGrabberVisible: true,
  },
});
