import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { LoroDoc, LoroMap, LoroList, LoroText } from 'loro-crdt/base64';

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
  assert.equal((await firstReply).messages[1].items[0].text, 'stream');
  const v2 = server.version();
  entry.get('items').get(0).get('text').insert(6, ' complete');
  entry.set('finished', true);
  server.commit();
  const fullUpdate = server.export({ mode: 'update', from: v2 });
  const finalReply = nextLive();
  sessionRead(live({ body: frame(fullUpdate) }, '3'));
  const final = await finalReply;
  assert.equal(final.messages.length, 2);
  assert.equal(final.messages[1].items[0].text, 'stream complete');
  assert.equal(final.messages[1].finished, true);
  const duplicate = nextLive();
  sessionRead(live({ body: frame(fullUpdate) }, '4'));
  assert.equal((await duplicate).messages.length, 2);
  const misordered = new LoroDoc();
  const assistant = misordered.getList('history').pushContainer(new LoroMap());
  assistant.set('id', 'a');
  assistant.set('role', 'assistant');
  assistant.set('userTurnId', 'u');
  const parent = misordered.getList('history').pushContainer(new LoroMap());
  parent.set('id', 'u');
  parent.set('role', 'user');
  assert.deepEqual(
    runtime.projectHistory(misordered).map((e) => e.id),
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
