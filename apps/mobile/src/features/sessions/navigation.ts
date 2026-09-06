import { router } from 'expo-router';
import { present } from '@/presentation';
import { showToast } from '@/ui/toast';
import type { Catalog, Session } from '@/cloud/model';
import { sessionPage } from './SessionScreen';
import { createSessionPage } from './CreateSessionScreen';

export async function openSession(session: Session) {
  try {
    await present(sessionPage, { session }, { title: session.title });
  } catch {
    showToast('暂时无法打开会话，请重试。');
  }
}
export async function newSession(
  workspaceId: string,
  catalog: Catalog,
  projectId?: string,
) {
  try {
    const result = await present(createSessionPage, {
      workspaceId,
      projects: catalog.projects,
      projectId,
    });
    if (result.status === 'completed')
      await present(
        sessionPage,
        { session: result.value.session, initialDraft: result.value.draft },
        { title: result.value.session.title },
      );
  } catch {
    showToast('暂时无法新建会话，请重试。');
  }
}
export function openCatalogRow(id: string, catalog: Catalog) {
  if (id.startsWith('project:')) {
    router.push({
      pathname: '/project/[projectId]',
      params: { projectId: id.slice(8) },
    });
    return;
  }
  const session = catalog.sessions.find((s) => s.id === id);
  if (session) void openSession(session);
}
