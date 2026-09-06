import type { Flock } from '@loro-dev/flock-wasm/base64';
import type { StreamsClient } from '@loro-dev/streams-client';
import { encodeFrame } from '../decoder/frames';
import { clientFor } from './session';

type Grant = () => Promise<{ token: string; gatewayBaseUrl: string }>;

async function appendJson(client: StreamsClient, update: unknown) {
  const result = await client.append({
    part: {
      contentType: 'application/octet-stream',
      body: encodeFrame(new TextEncoder().encode(JSON.stringify(update))),
    },
  });
  if (!result.ok) throw new Error(result.result.code);
}

export async function pinSession(
  args: { sessionId: string; pinned: boolean },
  meta: { flock: Flock; client: StreamsClient },
) {
  if (typeof args.sessionId !== 'string' || typeof args.pinned !== 'boolean')
    throw new Error('invalid_session');
  const room = `session-${args.sessionId}`;
  if (!meta.flock.get(['m', room])) throw new Error('session_not_found');
  const version = meta.flock.version();
  meta.flock.set(['m', room, 'isPinned'], args.pinned);
  meta.flock.commit();
  await appendJson(meta.client, meta.flock.exportJson(version));
}

export async function archiveSession(
  args: { workspaceId: string; sessionId: string; archived: boolean },
  meta: { flock: Flock; client: StreamsClient },
  machines: Map<string, Flock>,
  getGrant: Grant,
) {
  if (typeof args.sessionId !== 'string' || typeof args.archived !== 'boolean')
    throw new Error('invalid_session');
  const room = `session-${args.sessionId}`;
  const current = meta.flock.get(['m', room]) as
    Record<string, unknown> | undefined;
  if (!current) throw new Error('session_not_found');
  const machineId = String(current.machineId ?? '');
  const machine = machines.get(machineId);
  if (!machine) throw new Error('machine_unavailable');
  const key = ['cmd', 'archiveSession', args.sessionId];
  const machineVersion = machine.version();
  if (args.archived) machine.set(key, { v: 1, requestedAt: Date.now() });
  else machine.delete(key);
  machine.commit();
  const version = meta.flock.version();
  meta.flock.set(['m', room, 'isArchived'], args.archived);
  if (args.archived) meta.flock.set(['m', room, 'status'], { type: 'idle' });
  meta.flock.commit();
  await appendJson(meta.client, meta.flock.exportJson(version));
  const client = await clientFor(
    `${args.workspaceId}:mf:${machineId}`,
    getGrant,
  );
  await appendJson(client, machine.exportJson(machineVersion));
}
