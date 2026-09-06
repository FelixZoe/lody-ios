import type { NativeListSection } from '@lody-ios/kit';
import type { Catalog, Session } from '@/cloud/model';
// Relative on purpose: this module is imported directly by node --test, which
// does not resolve the `@/` alias. Keep it free of aliased value imports.
import {
  sessionState,
  stateSubtitle,
  stateLabel,
  stateSymbol,
  stateTint,
} from '../../ui/status.ts';
import { relativeTime } from '../../ui/time.ts';

const groups = [
  { id: 'attention', header: '需要你', states: ['attention', 'failed'] },
  { id: 'live', header: '进行中', states: ['live'] },
  { id: 'recent', header: '最近', states: ['idle', 'done', 'archived'] },
] as const;

export const RECENT_LIMIT = 20;

export type InboxOptions = {
  keyword?: string;
  accent: string;
  now?: number;
  limit?: number;
};

export function inboxSections(
  catalog: Catalog,
  { keyword = '', accent, now, limit = RECENT_LIMIT }: InboxOptions,
): NativeListSection[] {
  const names = new Map(catalog.projects.map((p) => [p.id, p.name]));
  const term = keyword.trim().toLocaleLowerCase();
  const matches = (session: Session) =>
    !term ||
    `${session.title} ${names.get(session.projectId) ?? ''}`
      .toLocaleLowerCase()
      .includes(term);

  const visible = catalog.sessions
    .filter((session) => (session.archived ? term.length > 0 : true))
    .filter(matches)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  return groups.flatMap((group) => {
    const rows = visible
      .filter((session) =>
        (group.states as readonly string[]).includes(
          sessionState(session.status, session.archived),
        ),
      )
      .slice(0, group.id === 'recent' ? limit : undefined)
      .map((session) => {
        const state = sessionState(session.status, session.archived);
        return {
          id: session.id,
          title: session.title,
          subtitle: stateSubtitle(
            state,
            names.get(session.projectId) ?? '',
            relativeTime(session.createdAt, now),
          ),
          image: stateSymbol[state],
          imageTint: stateTint(state, accent),
          action: true,
          disclosure: true,
          navigates: true,
        };
      });
    return rows.length ? [{ id: group.id, header: group.header, rows }] : [];
  });
}

export function sessionRow(session: Session, accent: string, projectName = '') {
  const state = sessionState(session.status, session.archived);
  return {
    id: session.id,
    title: session.title,
    subtitle: stateSubtitle(
      state,
      projectName,
      relativeTime(session.createdAt),
    ),
    image: stateSymbol[state],
    imageTint: stateTint(state, accent),
    action: true,
    disclosure: true,
    navigates: true,
  };
}

export function projectSections(
  catalog: Catalog,
  accent: string,
): NativeListSection[] {
  return catalog.projects.map((project) => {
    const sessions = catalog.sessions
      .filter((s) => s.projectId === project.id && !s.archived)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    return {
      id: project.id,
      header: project.name,
      headerValue: String(sessions.length),
      headerActionId: `project:${project.id}`,
      footer: sessions.length ? undefined : '暂无会话',
      rows: sessions.slice(0, 3).map((session) => {
        const state = sessionState(session.status);
        return {
          ...sessionRow(session, accent),
          subtitle: stateLabel[state],
          value: relativeTime(session.createdAt),
          image: ['attention', 'failed'].includes(state)
            ? stateSymbol[state]
            : undefined,
          disclosure: false,
        };
      }),
    };
  });
}

export function searchSections(
  catalog: Catalog,
  keyword: string,
  accent: string,
): NativeListSection[] {
  const term = keyword.trim().toLocaleLowerCase();
  if (!term) return [];
  const names = new Map(catalog.projects.map((p) => [p.id, p.name]));
  const projects = catalog.projects.filter((p) =>
    p.name.toLocaleLowerCase().includes(term),
  );
  const sessions = catalog.sessions
    .filter((s) =>
      `${s.title} ${names.get(s.projectId) ?? ''}`
        .toLocaleLowerCase()
        .includes(term),
    )
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return [
    {
      id: 'projects',
      header: '项目',
      rows: projects.map((p) => ({
        id: `project:${p.id}`,
        title: p.name,
        subtitle: p.rootPath,
        image: 'folder',
        action: true,
        disclosure: true,
        navigates: true,
      })),
    },
    {
      id: 'sessions',
      header: '会话',
      rows: sessions.map((s) => sessionRow(s, accent, names.get(s.projectId))),
    },
  ].filter((section) => section.rows.length);
}
