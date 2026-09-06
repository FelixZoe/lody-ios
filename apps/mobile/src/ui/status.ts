export type SessionState =
  'live' | 'attention' | 'failed' | 'idle' | 'done' | 'archived';

const states: Record<string, SessionState> = {
  running: 'live',
  processing: 'live',
  waiting: 'attention',
  error: 'failed',
  idle: 'idle',
  pending: 'idle',
  completed: 'done',
};

export function sessionState(status: string, archived = false): SessionState {
  return archived ? 'archived' : (states[status] ?? 'idle');
}

export const stateLabel: Record<SessionState, string> = {
  live: '进行中',
  attention: '等待确认',
  failed: '需要关注',
  idle: '待命',
  done: '已完成',
  archived: '已归档',
};

export function sessionStatus(status: string) {
  return stateLabel[sessionState(status)];
}

export const stateSymbol: Record<SessionState, string> = {
  live: 'circle.fill',
  attention: 'exclamationmark.circle.fill',
  failed: 'xmark.octagon.fill',
  idle: 'circle',
  done: 'checkmark',
  archived: 'archivebox',
};

/** Accent carries "live" only; every other state uses a system semantic color. */
export function stateTint(state: SessionState, accent: string) {
  return state === 'live'
    ? accent
    : state === 'attention'
      ? 'warning'
      : state === 'failed'
        ? 'danger'
        : state === 'archived'
          ? 'tertiary'
          : 'secondary';
}

/** Row subtitle: state word only where it earns the space, then project and time. */
export function stateSubtitle(state: SessionState, ...rest: string[]) {
  const lead = state === 'done' ? [] : [stateLabel[state]];
  return [...lead, ...rest.filter(Boolean)].join(' · ');
}
