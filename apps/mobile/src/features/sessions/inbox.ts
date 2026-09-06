import type { NativeListSection } from '@lody-ios/kit';
import type { Catalog, Session } from '@/cloud/model';
// Relative on purpose: this module is imported directly by node --test, which
// does not resolve the `@/` alias. Keep it free of aliased value imports.
import {
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
