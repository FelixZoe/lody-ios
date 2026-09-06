import { useEffect, useRef, useState } from 'react';
import {
  addDataRuntimeListener,
  watchSession,
  unwatchSession,
} from '@lody-ios/kit';
import { acceptEnvelope } from './acceptEnvelope';
import type { EntrySummary, Envelope, ItemSummary } from './transcript/types';

export type Snapshot = Omit<Envelope, 'v'>;

export function pendingPermission(entry: EntrySummary, requestId?: string) {
  for (const item of entry.items)
    if (
      item.type === 'tool_call' &&
      'permission' in item &&
      item.permission?.pending &&
      (!requestId || item.permission.requestId === requestId)
    )
      return item as Extract<ItemSummary, { type: 'tool_call' }>;
  return undefined;
}

export function useSessionRuntime(sessionId: string) {
  const [snapshot, setSnapshot] = useState<Snapshot>({
    status: 'syncing',
    revision: -1,
    entries: [],
  });
  const [overflow, setOverflow] = useState(false);
  const cursor = useRef({ generation: -1, revision: -1 });
  const reconnect = () =>
    void watchSession(sessionId).catch(() =>
      setSnapshot((old) => ({ ...old, status: 'offline' })),
    );
  useEffect(() => {
    const subscription = addDataRuntimeListener((event) => {
      if (event.sessionId === sessionId && event.session) {
        try {
          const data = JSON.parse(event.session);
          if (data.overflow && data.v === 1) {
            setOverflow(true);
            return;
          }
          const verdict = acceptEnvelope(cursor.current, event, data);
          if (verdict === 'drop') return;
          cursor.current = {
            generation: event.generation,
            revision: data.revision,
          };
          setOverflow(false);
          setSnapshot(data);
        } catch {
          setSnapshot((old) => ({ ...old, status: 'offline' }));
        }
      } else if (
        ['starting', 'background', 'failed', 'stopped'].includes(event.state)
      ) {
        setSnapshot((old) => ({ ...old, status: event.state }));
      }
    });
    reconnect();
    return () => {
      subscription.remove();
      void unwatchSession(sessionId);
    };
  }, [sessionId]);
  return { snapshot, overflow, cursor, reconnect };
}
