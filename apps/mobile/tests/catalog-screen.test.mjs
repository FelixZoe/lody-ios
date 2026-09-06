import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { transformSync } from '@babel/core';

const require = createRequire(import.meta.url);
test('compiled project screen renders login gate, project rows and empty placeholder', () => {
  const filename = new URL(
    '../src/features/machines/MachinesScreen.tsx',
    import.meta.url,
  ).pathname;
  const { code } = transformSync(readFileSync(filename, 'utf8'), {
    filename,
    presets: [require.resolve('babel-preset-expo')],
    caller: {
      name: 'metro',
      platform: 'ios',
      isDev: true,
      isServer: false,
      supportsStaticESM: false,
      supportsReactCompiler: true,
    },
  });
  let account = null,
    catalog = null,
    stateIndex = 0;
  const react = require('react');
  const mocks = {
    react: {
      ...react,
      useState: (initial) => [
        ['', catalog, null, true, 0, ''][stateIndex++] ?? initial,
        () => {},
      ],
      useEffect: () => {},
      useMemo: (factory) => factory(),
    },
    'react/compiler-runtime': {
      c: (size) => Array(size).fill(Symbol.for('react.memo_cache_sentinel')),
    },
    'expo-router': { Stack: { Screen: 'Stack.Screen' } },
    '@/features/auth/AuthProvider': { useAuth: () => ({ account }) },
    '@/features/auth/LoginPanel': { LoginPanel: 'LoginPanel' },
    '@/ui/Screen': { Screen: 'Screen' },
    '@/cloud/runtime': {},
    '@lody-ios/kit': {
      NativeGroupedList: 'NativeGroupedList',
      NativeMenuButton: 'NativeMenuButton',
    },
    '@/presentation': {},
    './ProjectSessionsScreen': {},
  };
  const exports = {};
  new Function('require', 'exports', '__DEV__', code)(
    (id) => mocks[id] ?? require(id),
    exports,
    false,
  );
  const list = () => {
    stateIndex = 0;
    const children = exports.default().props.children;
    return children.find((child) => child.type === 'NativeGroupedList');
  };

  stateIndex = 0;
  assert.equal(exports.default().type, 'Screen');

  account = {
    user: { name: 'Synthetic user' },
    workspaces: [{ id: 'w1', name: 'Workspace' }],
  };
  assert.deepEqual(list().props.sections[0].rows, []);
  assert.match(list().props.placeholder, /载入/);

  catalog = {
    projects: [{ id: 'p1', name: 'Project', rootPath: '/tmp/p1' }],
    sessions: [{ id: 's1', projectId: 'p1' }],
    machineIds: [],
  };
  const [row] = list().props.sections[0].rows;
  assert.equal(row.id, 'p1');
  assert.equal(row.subtitle, '/tmp/p1');
  assert.equal(row.value, '1');
  assert.equal(row.image, 'folder');
  assert.equal(row.navigates, true);

  catalog = null;
  assert.deepEqual(list().props.sections[0].rows, []);
});
