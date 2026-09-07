import { useEffect, useState } from 'react';
import {
  NativeGroupedList,
  listDir,
  previewContent,
  readFile,
  showToast,
  type DirectoryEntry,
  type NativeListSection,
} from '@lody-ios/kit';
import { definePage, usePageRuntime } from '@/presentation';
import { usePalette } from '@/theme/palette';
import { filePage } from './filePage';

export type FilesParams = {
  workspaceId: string;
  sessionId: string;
  userId: string;
  path: string;
  title: string;
};

const join = (base: string, name: string) => (base ? `${base}/${name}` : name);

const READ_ERRORS: Record<string, string> = {
  too_large: '文件太大，无法预览',
  file_not_found: '文件不存在',
  permission_denied: '没有读取权限',
  path_not_allowed: '路径不在项目内',
  decode_error: '文件内容无法解码',
};

function FilesScreen() {
  const { params, push } = usePageRuntime<FilesParams>();
  const colors = usePalette();
  const [entries, setEntries] = useState<DirectoryEntry[]>();
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [opening, setOpening] = useState('');

  useEffect(() => {
    let active = true;
    setError('');
    listDir({
      workspaceId: params.workspaceId,
      sessionId: params.sessionId,
      relativePath: params.path,
      userId: params.userId,
    })
      .then((listing) => {
        if (!active) return;
        setEntries(listing.entries);
        setTruncated(listing.truncated);
      })
      .catch((cause: Error) => {
        if (active)
          setError(
            /permission_denied/.test(String(cause))
              ? '此会话已归档，无法读取文件'
              : '无法读取文件夹，请确认电脑在线。',
          );
      });
    return () => {
      active = false;
    };
  }, [params.workspaceId, params.sessionId, params.path, revision]);

  const open = async (entry: DirectoryEntry) => {
    const path = join(params.path, entry.name);
    if (entry.type === 'directory') {
      void push(
        filesPage,
        { ...params, path, title: entry.name },
        { title: entry.name },
      );
      return;
    }
    if (opening) return;
    setOpening(path);
    try {
      const file = await readFile({ sessionId: params.sessionId, path });
      if (file.status !== 'ok') {
        showToast(READ_ERRORS[file.code] ?? file.message ?? '无法读取文件');
        return;
      }
      if (file.kind === 'image' || file.kind === 'binary')
        await previewContent(file.handle);
      else
        void push(
          filePage,
          { path, handle: file.handle, bytes: file.bytes },
          { title: entry.name },
        );
    } catch {
      showToast('电脑离线，无法读取文件');
    } finally {
      setOpening('');
    }
  };

  const sections: NativeListSection[] = [
    {
      id: 'entries',
      footer: error || (truncated ? '目录过大，仅显示前 2000 项' : undefined),
      rows: [
        ...(entries ?? []).map((entry) => ({
          id: `entry:${entry.name}`,
          title: entry.name,
          image: entry.type === 'directory' ? 'folder' : 'doc.text',
          imageTint: entry.type === 'directory' ? undefined : 'secondary',
          action: true,
          navigates: entry.type === 'directory',
          disclosure: entry.type === 'directory',
        })),
        ...(error ? [{ id: 'retry', title: '重试', action: true }] : []),
      ],
    },
  ];

  return (
    <NativeGroupedList
      style={{ flex: 1 }}
      accent={colors.accent}
      sections={sections}
      placeholder={entries ? '空文件夹' : '读取中…'}
      onRowPress={({ nativeEvent: { id } }) => {
        if (id === 'retry') {
          setRevision((n) => n + 1);
          return;
        }
        const entry = entries?.find((item) => `entry:${item.name}` === id);
        if (entry) void open(entry);
      }}
    />
  );
}

export const filesPage = definePage<FilesParams>({
  id: 'files',
  title: '项目文件',
  Component: FilesScreen,
  parseRouteParams: () => {
    throw new Error('请从会话打开');
  },
  presentation: { style: 'push', headerVariant: 'transparent' },
});
