import { LoroDoc, LoroMap, LoroList, LoroText } from 'loro-crdt/base64';
import { StreamsClient } from '@loro-dev/streams-client';
import { decompress } from 'fzstd';
import { decodeFrames, encodeFrame } from '../decoder/frames';
import {
  identityAt,
  itemRev,
  projectSession,
  resetProjection,
} from './project';
export { projectSession } from './project';

type Grant = { token: string; gatewayBaseUrl: string };
let active:
  | {
      id: string;
      workspace: string;
      doc: LoroDoc;
      client: StreamsClient;
      controller: AbortController;
      ready: boolean;
      sending: boolean;
      getGrant: () => Promise<Grant>;
      markDispatch: (sessionId: string, turnId: string) => Promise<void>;
      emit: (event: object) => void;
    }
  | undefined;
let pending: ReturnType<typeof setTimeout> | undefined;
let firstQueuedAt = 0;
let lastSignal = '';
function signalOf(state: NonNullable<typeof active>, status: string) {
  const history = state.doc.getList('history');
  let finished = 0;
  for (let i = 0; i < history.length; i++) {
    const entry = history.get(i);
    if (entry instanceof LoroMap && entry.get('finished') === true) finished++;
  }
  const awaiting = state.doc.getMap('session').get('awaitingUserSince') != null;
  return `${status}|${awaiting}|${finished}`;
}
function scheduleEmit(
  state: NonNullable<typeof active>,
  status: string,
  reason?: string,
) {
  const flush = () => {
    pending = undefined;
    firstQueuedAt = 0;
    if (active !== state) return;
    state.emit({
      type: 'session',
      sessionId: state.id,
      session: JSON.stringify(projectSession(state.doc, status, reason)),
    });
  };
  if (pending) clearTimeout(pending);
  const signal = signalOf(state, status);
  const now = Date.now();
  if (signal !== lastSignal || (firstQueuedAt && now - firstQueuedAt >= 200)) {
    lastSignal = signal;
    flush();
    return;
  }
  if (!firstQueuedAt) firstQueuedAt = now;
  pending = setTimeout(flush, 100);
}
export function closeSession() {
  unsent.clear();
  if (pending) clearTimeout(pending);
  pending = undefined;
  firstQueuedAt = 0;
  lastSignal = '';
  active?.controller.abort();
  active = undefined;
}
function unpack(bytes: Uint8Array) {
  return bytes[0] === 0x28 &&
    bytes[1] === 0xb5 &&
    bytes[2] === 0x2f &&
    bytes[3] === 0xfd
    ? decompress(bytes)
    : bytes;
}
export function importUpdates(doc: LoroDoc, bytes: Uint8Array) {
  for (const frame of decodeFrames(bytes)) doc.import(frame);
}
export async function clientFor(id: string, getGrant: () => Promise<Grant>) {
  const grant = await getGrant();
  return new StreamsClient({
    url: `${grant.gatewayBaseUrl.replace(/\/$/, '')}/ds/lody/${encodeURIComponent(id)}`,
    auth: async () => (await getGrant()).token,
    retry: { maxAttempts: 1 },
    timeout: { connectTimeoutMs: 15000, pollTimeoutMs: 35000 },
  });
}
export async function openSession(
  id: string,
  workspace: string,
  getGrant: () => Promise<Grant>,
  emit: (event: object) => void,
  markDispatch: (sessionId: string, turnId: string) => Promise<void>,
) {
  closeSession();
  const controller = new AbortController();
  const state = {
    id,
    workspace,
    doc: new LoroDoc(),
    client: undefined as unknown as StreamsClient,
    controller,
    ready: false,
    sending: false,
    getGrant,
    markDispatch,
    emit,
  };
  active = state;
  resetProjection();
  const event = (status: string, reason?: string) => {
    if (active === state) scheduleEmit(state, status, reason);
  };
  event('syncing');
  void (async () => {
    try {
      state.client = await clientFor(`${workspace}:s:${id}`, getGrant);
      const initial = await state.client.bootstrap({
        signal: controller.signal,
      });
      if (!initial.ok) throw new Error(initial.result.code);
      if (active !== state) return;
      const data = initial.result;
      let size = 0;
      const consume = (bytes: Uint8Array, snapshot = false) => {
        size += bytes.length;
        if (size > 32 * 1024 * 1024) throw new Error('session_limit');
        if (snapshot) state.doc.import(unpack(bytes));
        else importUpdates(state.doc, bytes);
      };
      if (data.snapshotOffset !== '-1' && data.snapshot)
        consume(data.snapshot.body, true);
      for (const part of data.updates) consume(part.body);
      let pages = 0;
      let offset = data.nextOffset,
        cursor = data.cursor,
        upToDate = data.upToDate;
      while (active === state && !controller.signal.aborted) {
        state.ready = upToDate;
        if (upToDate) {
          event('live');
          pages = 0;
        } else if (++pages > 100) throw new Error('session_limit');
        const next = await state.client.readOnce({
          offset,
          cursor,
          signal: controller.signal,
          ...(upToDate ? { live: 'long-poll' as const } : {}),
        });
        if (!next.ok) throw new Error(next.result.code);
        if (active !== state) return;
        if (next.result.payload) consume(next.result.payload.body);
        if (next.result.nextOffset === offset && !next.result.upToDate)
          throw new Error('stalled_cursor');
        offset = next.result.nextOffset;
        cursor = next.result.cursor;
        upToDate = next.result.upToDate;
        if (next.result.closed) throw new Error('stream_closed');
        if (!next.result.payload?.body.length && upToDate)
          await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (error) {
      state.ready = false;
      event('offline', error instanceof Error ? error.message : 'sync_failed');
    }
  })();
  return 'watching';
}
export function appendUserTurn(
  doc: LoroDoc,
  id: string,
  text: string,
  userId: string,
  config: Record<string, any>,
  timestamp: string,
) {
  const history = doc.getList('history');
  const entry = history.pushContainer(new LoroMap());
  for (const [key, value] of Object.entries({
    id,
    role: 'user',
    userId,
    timestamp,
    status: 'pending',
    read: false,
    finished: true,
    fileDiff: [],
  }))
    entry.set(key, value);
  const items = entry.setContainer('items', new LoroList());
  const item = items.pushContainer(new LoroMap());
  item.set('type', 'text');
  item.setContainer('text', new LoroText()).insert(0, text);
  const input = entry.setContainer('inputConfig', new LoroMap());
  for (const [key, value] of Object.entries(config))
    if (value !== undefined) input.set(key, value);
  doc.commit();
}
export async function sendTurn(args: {
  sessionId: string;
  machineId: string;
  userId: string;
  text: string;
  cliType: string;
  agentType: string;
  resume?: string;
  modelId?: string;
  modeId?: string;
}) {
  const state = active;
  if (!state || state.id !== args.sessionId || !state.ready || state.sending)
    throw new Error('session_not_ready');
  const text = args.text.trim();
  if (
    !text ||
    text.length > 32000 ||
    !args.userId ||
    !args.machineId ||
    !args.agentType ||
    !args.cliType
  )
    throw new Error('invalid_message');
  const id = crypto.randomUUID(),
    timestamp = new Date().toISOString();
  state.sending = true;
  let uploaded = false;
  try {
    const previous =
      (state.doc.toJSON().history as any[] | undefined)?.findLast(
        (entry) => entry.role === 'user',
      )?.inputConfig ?? {};
    if (previous.agentRoleId)
      throw new Error('agent_role_requires_configuration');
    const inputConfig = {
      cliType: args.cliType,
      agentType: args.agentType,
      prompt: text,
      inputBlocks: [{ type: 'text', text }],
      // An explicit pick wins; otherwise the turn inherits what the session
      // already used, and an unset value leaves the machine on its default.
      modeId: args.modeId ?? previous.modeId,
      modelId: args.modelId ?? previous.modelId,
      configOptionValues: previous.configOptionValues,
      mcpServerIds: previous.mcpServerIds ?? [],
      taskToolsEnabled: previous.taskToolsEnabled ?? false,
      resume: args.resume,
    };
    const before = state.doc.version();
    appendUserTurn(state.doc, id, text, args.userId, inputConfig, timestamp);
    const result = await state.client.append({
      part: {
        contentType: 'application/octet-stream',
        body: encodeFrame(state.doc.export({ mode: 'update', from: before })),
      },
    });
    if (!result.ok) throw new Error(result.result.code);
    uploaded = true;
    await state.markDispatch(state.id, id);
    if (active !== state) throw new Error('runtime_replaced');
    scheduleEmit(state, 'live');
    const replyTo = `${state.workspace}:rpc:res:${args.machineId}:${crypto.randomUUID()}`;
    const responseClient = await clientFor(replyTo, state.getGrant);
    const created = await responseClient.create({
      contentType: 'application/json',
      ttlSeconds: 300,
    });
    if (!created.ok) throw new Error(created.result.code);
    const requestId = crypto.randomUUID(),
      now = Date.now();
    const requestClient = await clientFor(
      `${state.workspace}:rpc:req:${args.machineId}`,
      state.getGrant,
    );
    const dispatched = await requestClient.append({
      part: {
        contentType: 'application/json',
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: requestId,
          rpcVersion: '1',
          workspaceId: state.workspace,
          machineId: args.machineId,
          replyTo,
          sentAt: now,
          expiresAt: now + 15000,
          method: 'session/dispatch-turn',
          params: {
            sessionId: state.id,
            userTurnId: id,
            userId: args.userId,
            timestamp,
            inputConfig,
          },
        }),
      },
    });
    if (!dispatched.ok) throw new Error(dispatched.result.code);
    const signal = AbortSignal.any([
      state.controller.signal,
      AbortSignal.timeout(18000),
    ]);
    let offset = '-1';
    while (!signal.aborted) {
      const read = await responseClient.readOnce({
        offset,
        live: 'long-poll',
        signal,
      });
      if (!read.ok) throw new Error(read.result.code);
      offset = read.result.nextOffset;
      if (!read.result.payload) continue;
      const parsed = JSON.parse(
        new TextDecoder().decode(read.result.payload.body),
      );
      for (const reply of Array.isArray(parsed) ? parsed : [parsed]) {
        if (reply.id !== requestId) continue;
        if (!reply.result?.accepted)
          throw new Error(
            reply.error?.message ??
              reply.result?.error ??
              reply.result?.disposition ??
              'dispatch_rejected',
          );
        return { id, state: 'accepted' };
      }
    }
    throw new Error('ack_timeout');
  } catch (error) {
    // No automatic write replay: a lost HTTP ACK may still mean a durable write.
    return {
      id,
      state: uploaded ? 'uploaded' : 'unknown',
      reason: error instanceof Error ? error.message : 'send_failed',
    };
  } finally {
    state.sending = false;
  }
}

export function docSnapshot() {
  return active?.doc.toJSON();
}
function locateItem(entryId: string, itemId: string) {
  const state = active;
  if (!state) return undefined;
  const history = state.doc.getList('history');
  for (let i = 0; i < history.length; i++) {
    const entry = history.get(i);
    if (!(entry instanceof LoroMap) || entry.get('id') !== entryId) continue;
    const items = entry.get('items');
    if (!(items instanceof LoroList)) return undefined;
    for (let j = 0; j < items.length; j++) {
      const item = items.get(j);
      if (!(item instanceof LoroMap)) continue;
      const id =
        item.get('type') === 'tool_call' &&
        typeof item.get('toolCallId') === 'string'
          ? (item.get('toolCallId') as string)
          : identityAt(items, j);
      if (id === itemId) return item;
    }
    return undefined;
  }
  return undefined;
}
const DETAIL_LIMIT = 512 * 1024;
export async function itemDetail(args: {
  sessionId: string;
  entryId: string;
  itemId: string;
  cursor?: string;
}) {
  if (!active || active.id !== args.sessionId)
    throw new Error('session_not_ready');
  const item = locateItem(args.entryId, args.itemId);
  const raw: any = item?.toJSON() ?? {};
  const content: unknown[] = Array.isArray(raw.content) ? raw.content : [];
  const start = Math.max(0, Number(args.cursor ?? 0) || 0);
  const blocks: unknown[] = [];
  let size = 0;
  let next = content.length;
  for (let i = start; i < content.length; i++) {
    const bytes = JSON.stringify(content[i]).length;
    if (blocks.length && size + bytes > DETAIL_LIMIT) {
      next = i;
      break;
    }
    blocks.push(content[i]);
    size += bytes;
  }
  const truncated = next < content.length;
  return {
    itemId: args.itemId,
    rev: itemRev(args.entryId, args.itemId),
    blocks,
    rawInput: raw.rawInput,
    rawOutput: raw.rawOutput,
    options: raw.permissionRequest?.options,
    outcome: raw.permissionRequest?.outcome,
    truncated,
    nextCursor: truncated ? String(next) : undefined,
  };
}
const unsent = new Map<string, ReturnType<LoroDoc['version']>>();
export async function respondPermission(args: {
  sessionId: string;
  entryId: string;
  itemId: string;
  requestId: string;
  optionId: string;
}) {
  const state = active;
  if (!state || state.id !== args.sessionId || !state.ready)
    throw new Error('session_not_ready');
  const item = locateItem(args.entryId, args.itemId);
  const request = item?.get('permissionRequest');
  const current: any =
    request instanceof LoroMap ? request.toJSON() : (request ?? undefined);
  if (!item || !current || current.requestId !== args.requestId)
    return { state: 'stale' as const };
  const options: any[] = Array.isArray(current.options) ? current.options : [];
  if (!options.some((o) => o?.optionId === args.optionId))
    throw new Error('invalid_option');
  const key = `${args.entryId}/${args.itemId}/${args.requestId}`;
  if (current.outcome != null) {
    if (current.outcome.optionId !== args.optionId)
      return { state: 'conflict' as const };
    if (!unsent.has(key)) return { state: 'accepted' as const };
  }
  const before = unsent.get(key) ?? state.doc.version();
  if (current.outcome == null) {
    const outcome = { outcome: 'selected', optionId: args.optionId };
    if (request instanceof LoroMap) request.set('outcome', outcome);
    else item.set('permissionRequest', { ...current, outcome });
    state.doc.commit();
  }
  const result = await state.client.append({
    part: {
      contentType: 'application/octet-stream',
      body: encodeFrame(state.doc.export({ mode: 'update', from: before })),
    },
  });
  if (!result.ok) {
    // A user-initiated retry re-exports from this version; nothing replays on its own.
    unsent.set(key, before);
    throw new Error('upload_failed');
  }
  unsent.delete(key);
  if (active === state) scheduleEmit(state, 'live');
  return { state: 'accepted' as const };
}
