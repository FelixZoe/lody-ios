import { LoroDoc, LoroMap, LoroList, LoroText } from 'loro-crdt/base64';
import { StreamsClient } from '@loro-dev/streams-client';
import { decompress } from 'fzstd';
import { decodeFrames, encodeFrame } from '../decoder/frames';

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
export function closeSession() {
  active?.controller.abort();
  active = undefined;
}
export function projectHistory(doc: LoroDoc) {
  const history = doc.toJSON().history;
  if (!Array.isArray(history)) return [];
  // A daemon history-sync timeout can place a concurrent reply before its input.
  // Use its explicit causal link; never sort streamed turns by arrival time.
  const userIds = new Set(
    history.filter((e: any) => e.role === 'user').map((e: any) => e.id),
  );
  const replies = new Map<string, any[]>();
  for (const entry of history)
    if (entry.role === 'assistant' && userIds.has(entry.userTurnId)) {
      const group = replies.get(entry.userTurnId) ?? [];
      group.push(entry);
      replies.set(entry.userTurnId, group);
    }
  const ordered = history.flatMap((entry: any) =>
    entry.role === 'assistant' && userIds.has(entry.userTurnId)
      ? []
      : [
          entry,
          ...(entry.role === 'user' ? (replies.get(entry.id) ?? []) : []),
        ],
  );
  return ordered.map((entry: any) => ({
    id: String(entry.id),
    role: String(entry.role),
    status: entry.status ?? (entry.read ? 'seen' : 'pending'),
    finished: entry.finished === true,
    items: Array.isArray(entry.items)
      ? entry.items.map((item: any) => ({
          type: String(item.type),
          text: typeof item.text === 'string' ? item.text : '',
          // Preserve a visible placeholder for blocks this text-only POC cannot render.
          label:
            typeof item.title === 'string' ? item.title : String(item.type),
        }))
      : [],
  }));
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
  const event = (status: string, reason?: string) => {
    if (active === state)
      emit({
        type: 'session',
        sessionId: id,
        session: JSON.stringify({
          status,
          reason,
          messages: projectHistory(state.doc),
        }),
      });
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
      modeId: previous.modeId,
      modelId: previous.modelId,
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
    state.emit({
      type: 'session',
      sessionId: state.id,
      session: JSON.stringify({
        status: 'live',
        messages: projectHistory(state.doc),
      }),
    });
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
