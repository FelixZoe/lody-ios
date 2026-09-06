import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { LoroDoc, LoroMap, LoroList, LoroText } from 'loro-crdt/base64';
import { openTestSession } from './helpers.mjs';

test('send persists user before dispatch; duplicate incremental imports preserve one ordered streaming reply', async () => {
  const server = new LoroDoc();
  let sessionRead,
    rpc,
    appends = 0,
    acknowledged = true,
    loseAppendAck = false;
  const frame = (bytes) => {
    const result = new Uint8Array(bytes.length + 4);
    new DataView(result.buffer).setUint32(0, bytes.length, false);
    result.set(bytes, 4);
    return result;
  };
  const ok = (result) => ({ ok: true, result });
  const live = (payload, offset = '2') =>
    ok({ nextOffset: offset, upToDate: true, closed: false, payload });
  globalThis.__sessionClient = class {
    constructor({ url }) {
      this.url = decodeURIComponent(url);
    }
    async bootstrap() {
      return ok({
        snapshotOffset: '1',
        nextOffset: '1',
        upToDate: true,
        snapshot: { body: server.export({ mode: 'snapshot' }) },
        updates: [],
      });
    }
    readOnce() {
      if (this.url.includes(':rpc:res:'))
        return Promise.resolve(
          live({
            body: new TextEncoder().encode(
              JSON.stringify([
                { id: rpc.id, result: { accepted: acknowledged } },
              ]),
            ),
          }),
        );
      return new Promise((resolve) => {
        sessionRead = resolve;
      });
    }
    async create() {
      return ok({});
    }
    async append({ part }) {
      if (this.url.includes(':rpc:req:')) {
        rpc = JSON.parse(part.body);
        assert.equal(server.toJSON().history[0].id, rpc.params.userTurnId);
      } else {
        appends++;
        assert.equal(
          new DataView(part.body.buffer, part.body.byteOffset).getUint32(
            0,
            false,
          ),
          part.body.length - 4,
        );
        server.import(part.body.subarray(4));
      }
      if (loseAppendAck && !this.url.includes(':rpc:req:'))
        return { ok: false, result: { code: 'timeout' } };
      return ok({ nextOffset: '2' });
    }
  };
  const bundle = await build({
    entryPoints: ['apps/mobile/modules/lody-kit/data-runtime/session.ts'],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    write: false,
    plugins: [
      {
        name: 'stream',
        setup(b) {
          b.onResolve({ filter: /^@loro-dev\/streams-client$/ }, () => ({
            path: 'mock',
            namespace: 'test',
          }));
          b.onLoad({ filter: /.*/, namespace: 'test' }, () => ({
            contents: 'export const StreamsClient=globalThis.__sessionClient',
          }));
        },
      },
    ],
  });
  const runtime = await import(
    `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`
  );
  const events = [];
  let resolveLive;
  const nextLive = () =>
    new Promise((resolve) => {
      resolveLive = resolve;
    });
  const initial = nextLive();
  await runtime.openSession(
    's1',
    'w1',
    async () => ({
      token: 'synthetic',
      gatewayBaseUrl: 'https://example.invalid',
    }),
    (e) => {
      const value = JSON.parse(e.session);
      events.push(value);
      if (value.status === 'live') resolveLive?.(value);
    },
    async (sessionId, turnId) => {
      assert.equal(sessionId, 's1');
      assert.equal(server.toJSON().history[0].id, turnId);
    },
  );
  await initial;
  const result = await runtime.sendTurn({
    sessionId: 's1',
    machineId: 'm1',
    userId: 'u1',
    text: 'POC hello',
    cliType: 'builtin',
    agentType: 'codex',
  });
  assert.equal(result.state, 'accepted');
  assert.equal(appends, 1);
  const user = server.toJSON().history[0];
  assert.equal(user.items[0].text, 'POC hello');
  assert.deepEqual(user.inputConfig.mcpServerIds, []);
  const version = server.version();
  const entry = server.getList('history').pushContainer(new LoroMap());
  entry.set('id', 'reply');
  const item = entry
    .setContainer('items', new LoroList())
    .pushContainer(new LoroMap());
  item.set('type', 'text');
  item.setContainer('text', new LoroText()).insert(0, 'stream');
  entry.set('role', 'assistant');
  entry.set('finished', false);
  server.commit();
  const update = server.export({ mode: 'update', from: version });
  const firstReply = nextLive();
  sessionRead(live({ body: frame(update) }));
  assert.equal((await firstReply).entries[1].items[0].text, 'stream');
  const v2 = server.version();
  entry.get('items').get(0).get('text').insert(6, ' complete');
  entry.set('finished', true);
  server.commit();
  const fullUpdate = server.export({ mode: 'update', from: v2 });
  const finalReply = nextLive();
  sessionRead(live({ body: frame(fullUpdate) }, '3'));
  const final = await finalReply;
  assert.equal(final.entries.length, 2);
  assert.equal(final.entries[1].items[0].text, 'stream complete');
  assert.equal(final.entries[1].finished, true);
  const duplicate = nextLive();
  sessionRead(live({ body: frame(fullUpdate) }, '4'));
  assert.equal((await duplicate).entries.length, 2);
  const misordered = new LoroDoc();
  const assistant = misordered.getList('history').pushContainer(new LoroMap());
  assistant.set('id', 'a');
  assistant.set('role', 'assistant');
  assistant.set('userTurnId', 'u');
  const parent = misordered.getList('history').pushContainer(new LoroMap());
  parent.set('id', 'u');
  parent.set('role', 'user');
  assert.deepEqual(
    runtime.projectSession(misordered, 'live').entries.map((e) => e.id),
    ['u', 'a'],
  );
  const oldRead = sessionRead;
  runtime.closeSession();
  oldRead(live({ body: frame(update) }, '5'));
  await assert.rejects(
    runtime.sendTurn({ sessionId: 's1', text: 'no' }),
    /session_not_ready/,
  );
  assert.equal(appends, 1);
  const reopen = nextLive();
  await runtime.openSession(
    's1',
    'w1',
    async () => ({
      token: 'synthetic',
      gatewayBaseUrl: 'https://example.invalid',
    }),
    (e) => {
      const value = JSON.parse(e.session);
      if (value.status === 'live') resolveLive?.(value);
    },
    async () => {},
  );
  await reopen;
  loseAppendAck = true;
  const uncertain = await runtime.sendTurn({
    sessionId: 's1',
    machineId: 'm1',
    userId: 'u1',
    text: 'lost ACK',
    cliType: 'builtin',
    agentType: 'codex',
  });
  assert.equal(uncertain.state, 'unknown');
  assert.equal(
    server.toJSON().history.filter((e) => e.id === uncertain.id).length,
    1,
  );
  assert.equal(appends, 2);
  runtime.closeSession();
  delete globalThis.__sessionClient;
});

async function loadProject() {
  const bundle = await build({
    entryPoints: [
      new URL('../modules/lody-kit/data-runtime/project.ts', import.meta.url)
        .pathname,
    ],
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    write: false,
    external: ['loro-crdt/base64'],
  });
  return import(
    'data:text/javascript;base64,' +
      Buffer.from(bundle.outputFiles[0].text).toString('base64')
  );
}

test('projection carries stable item ids, tool summaries, and diff counts', async () => {
  const mod = await loadProject();

  const doc = new LoroDoc();
  const entry = doc.getList('history').pushContainer(new LoroMap());
  entry.set('id', 'e1');
  entry.set('role', 'assistant');
  entry.set('finished', false);
  const items = entry.setContainer('items', new LoroList());

  const prose = items.pushContainer(new LoroMap());
  prose.set('type', 'text');
  prose.setContainer('text', new LoroText()).insert(0, '看了一眼 auth.ts');

  const call = items.pushContainer(new LoroMap());
  call.set('type', 'tool_call');
  call.set('toolCallId', 'tc_1');
  call.set('kind', 'edit');
  call.set('title', 'Edit src/auth.ts');
  call.set('status', 'completed');
  call.set('content', [
    {
      type: 'diff',
      path: 'src/auth.ts',
      oldText: 'a\nb\nc\n',
      newText: 'a\nB\nc\nd\n',
    },
  ]);
  doc.commit();

  const first = mod.projectSession(doc, 'live');
  assert.equal(first.v, 1);
  assert.equal(first.entries.length, 1);

  const [textItem, toolItem] = first.entries[0].items;
  assert.equal(textItem.type, 'text');
  assert.equal(textItem.text, '看了一眼 auth.ts');
  assert.match(textItem.itemId, /^\d+:\d+$/);

  assert.equal(toolItem.itemId, 'tc_1');
  assert.equal(toolItem.kind, 'edit');
  assert.equal(toolItem.path, 'src/auth.ts');
  assert.equal(toolItem.added, 2);
  assert.equal(toolItem.removed, 1);
  assert.equal(toolItem.hasDetail, true);
  assert.equal(toolItem.permission, undefined);

  const idBefore = textItem.itemId;
  prose.get('text').insert(11, '，超时来自 fetch');
  doc.commit();
  const second = mod.projectSession(doc, 'live');
  assert.equal(second.entries[0].items[0].itemId, idBefore);
  assert.ok(second.entries[0].items[0].rev > textItem.rev);
  assert.equal(second.entries[0].items[1].rev, toolItem.rev);
  assert.ok(second.revision > first.revision);
});

test('unchanged entries keep their summary objects; prose is coalesced, status is not', async () => {
  const { projectSession, resetProjection } = await loadProject();
  resetProjection();
  const doc = new LoroDoc();
  const first = doc.getList('history').pushContainer(new LoroMap());
  first.set('id', 'e1');
  first.set('role', 'user');
  const second = doc.getList('history').pushContainer(new LoroMap());
  second.set('id', 'e2');
  second.set('role', 'assistant');
  const items = second.setContainer('items', new LoroList());
  const prose = items.pushContainer(new LoroMap());
  prose.set('type', 'text');
  prose.setContainer('text', new LoroText()).insert(0, 'hi');
  doc.commit();

  const a = projectSession(doc, 'live');
  prose.get('text').insert(2, ' there');
  doc.commit();
  const b = projectSession(doc, 'live');

  assert.equal(a.entries[0].rev, b.entries[0].rev);
  assert.ok(b.entries[1].rev > a.entries[1].rev);
});

test('itemDetail 按需取回 blocks，超限分页，缺失不抛错', async () => {
  const { runtime, server, pushUpdate, close } = await openTestSession();
  const entry = server.getList('history').pushContainer(new LoroMap());
  entry.set('id', 'e9');
  entry.set('role', 'assistant');
  const items = entry.setContainer('items', new LoroList());
  const call = items.pushContainer(new LoroMap());
  call.set('type', 'tool_call');
  call.set('toolCallId', 'tc_9');
  call.set('kind', 'execute');
  call.set('status', 'completed');
  call.set('content', [
    { type: 'terminal_command', command: 'pnpm', args: ['test'], cwd: '/w' },
    { type: 'terminal_output', output: 'ok\n', stream: 'combined' },
  ]);
  server.commit();
  await pushUpdate();

  const detail = await runtime.itemDetail({
    sessionId: 's1',
    entryId: 'e9',
    itemId: 'tc_9',
  });
  assert.equal(detail.itemId, 'tc_9');
  assert.equal(detail.blocks.length, 2);
  assert.equal(detail.blocks[0].command, 'pnpm');
  assert.equal(detail.truncated, false);
  assert.equal(detail.nextCursor, undefined);
  assert.ok(detail.rev > 0);

  call.set('content', [
    { type: 'terminal_output', output: 'x'.repeat(400 * 1024) },
    { type: 'terminal_output', output: 'y'.repeat(400 * 1024) },
  ]);
  server.commit();
  await pushUpdate();

  const page1 = await runtime.itemDetail({
    sessionId: 's1',
    entryId: 'e9',
    itemId: 'tc_9',
  });
  assert.equal(page1.truncated, true);
  assert.equal(page1.blocks.length, 1);
  assert.ok(page1.nextCursor);

  const page2 = await runtime.itemDetail({
    sessionId: 's1',
    entryId: 'e9',
    itemId: 'tc_9',
    cursor: page1.nextCursor,
  });
  assert.equal(page2.blocks.length, 1);
  assert.equal(page2.truncated, false);

  const missing = await runtime.itemDetail({
    sessionId: 's1',
    entryId: 'e9',
    itemId: 'nope',
  });
  assert.deepEqual(missing.blocks, []);
  assert.equal(missing.truncated, false);

  await assert.rejects(
    runtime.itemDetail({ sessionId: 'other', entryId: 'e9', itemId: 'tc_9' }),
    /session_not_ready/,
  );
  close();
});
