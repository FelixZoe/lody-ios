import type { NativeListSection } from '@lody-ios/kit';
import type { Catalog, Session } from '@/cloud/model';
import type { SessionState } from '../../ui/status.ts';
// Relative on purpose: this module is imported directly by node --test, which
// does not resolve the `@/` alias. Keep it free of aliased value imports.
import {
  agentName,
  sessionState,
  stateSubtitle,
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

export const activityAt = (session: Session) =>
  session.lastMessageAt ?? Date.parse(session.createdAt);
const byActivity = (a: Session, b: Session) => activityAt(b) - activityAt(a);
const badges: Partial<Record<SessionState, string>> = {
  attention: '等你确认',
  failed: '执行失败',
  archived: '已归档',
};

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
    .sort(byActivity);

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
            relativeTime(activityAt(session), now),
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

export function sessionRow(
  session: Session,
  accent: string,
  projectName = '',
  now?: number,
) {
  const state = sessionState(
    session.status,
    session.archived,
    session.awaitingUserSince !== undefined,
  );
  const lead = session.branchName ?? agentName(session.agentType);
  return {
    id: session.id,
    title: session.title,
    subtitle: [projectName, lead].filter(Boolean).join(' · '),
    subtitleMono: session.branchName !== undefined,
    diff: session.diff,
    value: relativeTime(activityAt(session), now),
    unread:
      session.lastMessageAt !== undefined &&
      (session.lastReadAt === undefined ||
        session.lastMessageAt > session.lastReadAt),
    badge: badges[state],
    image: ['live', 'attention', 'failed'].includes(state)
      ? 'circle.fill'
      : undefined,
    imageTint: stateTint(state, accent),
    action: true,
    disclosure: true,
    navigates: true,
  };
}

export function projectSections(
  catalog: Catalog,
  accent: string,
  expanded: Record<string, boolean> = {},
  now?: number,
): NativeListSection[] {
  return catalog.projects.map((project) => {
    const sessions = catalog.sessions
      .filter((s) => s.projectId === project.id && !s.archived)
      .sort(byActivity);
    const open = expanded[project.id] ?? true;
    return {
      id: project.id,
      header: project.name,
      headerValue: open ? undefined : String(sessions.length),
      headerActionId: `toggle:${project.id}`,
      headerExpanded: open,
      rows: open
        ? [
            ...sessions.slice(0, 5).map((session) => ({
              ...sessionRow(session, accent, '', now),
              disclosure: false,
            })),
            ...(sessions.length > 5
              ? [
                  {
                    id: `project:${project.id}`,
                    title: '更多',
                    action: true,
                    disclosure: true,
                    navigates: true,
                  },
                ]
              : []),
          ]
        : [],
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
    .sort(byActivity);
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
