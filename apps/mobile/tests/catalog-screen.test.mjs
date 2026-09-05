import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { transformSync } from '@babel/core';

const require = createRequire(import.meta.url);
test('compiled project screen renders login-to-loading and refresh-to-loading transitions', () => {
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
        ['', catalog, null, true, 0][stateIndex++] ?? initial,
        () => {},
      ],
      useEffect: () => {},
    },
    'react/compiler-runtime': {
      c: (size) => Array(size).fill(Symbol.for('react.memo_cache_sentinel')),
    },
    'react-native': {
      FlatList: 'FlatList',
      ActivityIndicator: 'ActivityIndicator',
      Text: 'Text',
      View: 'View',
    },
    'react-native-screens/experimental': {
      ScrollViewMarker: 'ScrollViewMarker',
    },
    'expo-router': {
      useTheme: () => ({ colors: { text: '#000', card: '#fff' } }),
    },
    '@/features/auth/AuthProvider': { useAuth: () => ({ account }) },
    '@/features/auth/LoginPanel': { LoginPanel: 'LoginPanel' },
    '@/ui/Screen': { Screen: 'Screen', softScrollEdgeEffects: {} },
    '@/ui/theme': {
      usePalette: () => ({
        text: '#000',
        card: '#fff',
        muted: '#666',
        subtle: '#eee',
      }),
    },
    '@/ui/Button': { Button: 'Button' },
    '@/cloud/runtime': {},
    '@lody-ios/kit': {},
    '@/presentation': {},
    './ProjectSessionsScreen': {},
  };
  const exports = {};
  new Function('require', 'exports', '__DEV__', code)(
    (id) => mocks[id] ?? require(id),
    exports,
    false,
  );
  const render = () => {
    stateIndex = 0;
    return exports.default();
  };
  assert.equal(render().type, 'Screen');
  account = {
    user: { name: 'Synthetic user' },
    workspaces: [{ id: 'w1', name: 'Workspace' }],
  };
  assert.deepEqual(render().props.children.props.data, []);
  catalog = {
    projects: [{ id: 'p1', name: 'Project' }],
    sessions: [],
    machineIds: [],
  };
  const list = render().props.children;
  assert.equal(list.props.data[0].id, 'p1');
  assert.doesNotThrow(() =>
    list.props.renderItem({ item: catalog.projects[0] }),
  );
  catalog = null;
  assert.deepEqual(render().props.children.props.data, []);
});
