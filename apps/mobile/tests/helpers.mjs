import { build } from 'esbuild';
import { LoroDoc } from 'loro-crdt/base64';

export async function loadRuntime() {
  const bundle = await build({
    entryPoints: [
      new URL('../modules/lody-kit/data-runtime/session.ts', import.meta.url)
        .pathname,
    ],
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
            contents:
              'export class StreamsClient{constructor(a){return new globalThis.__sessionClient(a)}}',
          }));
        },
      },
    ],
  });
  return import(
    `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`
  );
}

export function frame(bytes) {
  const result = new Uint8Array(bytes.length + 4);
  new DataView(result.buffer).setUint32(0, bytes.length, false);
  result.set(bytes, 4);
  return result;
}

export async function openTestSession({ failAppend = () => false } = {}) {
  const server = new LoroDoc();
  const ok = (result) => ({ ok: true, result });
  let sessionRead;
  let offset = 1;
  const appends = [];
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
      return new Promise((resolve) => {
        sessionRead = resolve;
      });
    }
    async create() {
      return ok({});
    }
    async append({ part }) {
      appends.push(this.url);
      if (failAppend(this.url))
        return { ok: false, result: { code: 'timeout' } };
      if (!this.url.includes(':rpc:')) server.import(part.body.subarray(4));
      return ok({ nextOffset: String(++offset) });
    }
  };
  const runtime = await loadRuntime();
  let resolveEmit;
  const events = [];
  const nextEmit = () =>
    new Promise((resolve) => {
      resolveEmit = resolve;
    });
  const ready = nextEmit();
  await runtime.openSession(
    's1',
    'w1',
    async () => ({ token: 'synthetic', gatewayBaseUrl: 'https://x.invalid' }),
    (e) => {
      const value = JSON.parse(e.session);
      events.push(value);
      if (value.status === 'live') resolveEmit?.(value);
    },
    async () => {},
  );
  await ready;
  let version = server.version();
  const pushUpdate = async () => {
    const update = server.export({ mode: 'update', from: version });
    version = server.version();
    const emitted = nextEmit();
    sessionRead(
      ok({
        nextOffset: String(++offset),
        upToDate: true,
        closed: false,
        payload: { body: frame(update) },
      }),
    );
    return emitted;
  };
  const close = () => {
    runtime.stopSessions();
    delete globalThis.__sessionClient;
  };
  return { runtime, server, pushUpdate, events, appends, close };
}
