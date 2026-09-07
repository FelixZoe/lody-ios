import { NativeGroupedList, type NativeListSection } from '@lody-ios/kit';
import { definePage, usePageRuntime } from '@/presentation';
import { usePalette } from '@/theme/palette';
import type { ChangedFile } from '../transcript/changes';
import { fileDiffPage } from './fileDiffPage';

export type TurnChangesParams = {
  sessionId: string;
  entryId: string;
  files: ChangedFile[];
};

export const basename = (path: string) =>
  path.split(/[\\/]/).filter(Boolean).at(-1) || path;
export const dirname = (path: string) =>
  path.split(/[\\/]/).filter(Boolean).slice(0, -1).join('/');

function TurnChangesScreen() {
  const { params, push } = usePageRuntime<TurnChangesParams>();
  const colors = usePalette();
  const add = params.files.reduce((sum, file) => sum + file.add, 0);
  const del = params.files.reduce((sum, file) => sum + file.del, 0);
  const sections: NativeListSection[] = [
    {
      id: 'files',
      header: `${params.files.length} 个文件`,
      headerValue: `+${add} −${del}`,
      rows: params.files.map((file) => ({
        id: file.path,
        title: basename(file.path),
        subtitle: dirname(file.path) || undefined,
        subtitleMono: true,
        badge: file.status,
        diff: { add: file.add, del: file.del },
        action: true,
        navigates: true,
        disclosure: true,
      })),
    },
  ];
  return (
    <NativeGroupedList
      style={{ flex: 1 }}
      accent={colors.accent}
      sections={sections}
      placeholder="本轮没有改动文件"
      onRowPress={({ nativeEvent: { id } }) =>
        void push(
          fileDiffPage,
          { sessionId: params.sessionId, entryId: params.entryId, path: id },
          { title: basename(id) },
        )
      }
    />
  );
}

export const turnChangesPage = definePage<TurnChangesParams>({
  id: 'turn-changes',
  title: '本轮改动',
  Component: TurnChangesScreen,
  parseRouteParams: () => {
    throw new Error('请从会话打开');
  },
  presentation: { style: 'push', headerVariant: 'transparent' },
});
