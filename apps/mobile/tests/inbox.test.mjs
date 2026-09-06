import assert from 'node:assert/strict';
import test from 'node:test';
import { inboxSections } from '../src/features/sessions/inbox.ts';
import { listPlaceholder } from '../src/ui/listState.ts';
import { draftTitle } from '../src/features/sessions/draftTitle.ts';

const ACCENT = '#3B4FD9';
const now = Date.parse('2026-09-06T15:00:00+08:00');

const session = (id, status, extra = {}) => ({
  id,
  machineId: 'm1',
  title: id,
  status,
  archived: false,
  projectId: 'p1',
  createdAt: '2026-09-06T14:00:00+08:00',
  ...extra,
});

const catalog = (sessions, projects = [{ id: 'p1', name: 'lody-ios' }]) => ({
  projects,
  sessions,
  machineIds: ['m1'],
});

const build = (data, options = {}) =>
  inboxSections(data, { accent: ACCENT, now, ...options });

test('groups run attention, live, recent in that order', () => {
  const sections = build(
    catalog([
      session('done-1', 'completed'),
      session('live-1', 'running'),
      session('wait-1', 'waiting'),
    ]),
  );
  assert.deepEqual(
    sections.map((s) => s.id),
    ['attention', 'live', 'recent'],
  );
  assert.deepEqual(
    sections.map((s) => s.header),
    ['需要你', '进行中', '最近'],
  );
});

test('empty groups are not rendered at all', () => {
  const sections = build(catalog([session('live-1', 'running')]));
  assert.deepEqual(
    sections.map((s) => s.id),
    ['live'],
  );
});

test('errors join waiting under 需要你', () => {
  const [first] = build(
    catalog([session('err', 'error'), session('wait', 'waiting')]),
  );
  assert.equal(first.id, 'attention');
  assert.equal(first.rows.length, 2);
});

test('archived sessions stay out of the inbox until searched', () => {
  const data = catalog([session('old', 'completed', { archived: true })]);
  assert.deepEqual(build(data), []);
  assert.equal(build(data, { keyword: 'old' })[0].rows[0].id, 'old');
});

test('search matches the project name, not only the title', () => {
  const data = catalog([session('s1', 'running')]);
  assert.equal(build(data, { keyword: 'LODY-IOS' })[0].rows.length, 1);
  assert.deepEqual(build(data, { keyword: 'yohaku' }), []);
});

test('subtitle reads state, project, then relative time', () => {
  const [group] = build(catalog([session('s1', 'waiting')]));
  assert.equal(group.rows[0].subtitle, '等待确认 · lody-ios · 1 小时前');
});

test('only live rows carry the accent tint', () => {
  const sections = build(
    catalog([session('live', 'running'), session('wait', 'waiting')]),
  );
  const tints = sections.flatMap((s) => s.rows.map((r) => r.imageTint));
  assert.equal(tints.filter((tint) => tint === ACCENT).length, 1);
});

test('recent is capped; attention and live are not', () => {
  const many = (status, n) =>
    Array.from({ length: n }, (_, i) => session(`${status}-${i}`, status));
  const sections = build(
    catalog([...many('completed', 30), ...many('waiting', 30)]),
    {
      limit: 20,
    },
  );
  const byId = Object.fromEntries(sections.map((s) => [s.id, s.rows.length]));
  assert.equal(byId.recent, 20);
  assert.equal(byId.attention, 30);
});

test('newest sessions come first inside a group', () => {
  const [group] = build(
    catalog([
      session('older', 'running', { createdAt: '2026-09-01T10:00:00+08:00' }),
      session('newer', 'running', { createdAt: '2026-09-06T10:00:00+08:00' }),
    ]),
  );
  assert.deepEqual(
    group.rows.map((r) => r.id),
    ['newer', 'older'],
  );
});

test('placeholder covers loading, empty search, offline and first run', () => {
  assert.match(listPlaceholder({ loading: true }), /载入/);
  assert.match(listPlaceholder({ filtered: true }), /没有匹配/);
  assert.match(listPlaceholder({ connected: false }), /连接已中断/);
  assert.match(listPlaceholder({}), /连接电脑/);
});

test('the session title comes from the first line of the first message', () => {
  assert.equal(draftTitle('  修复看门狗重启  \n更多细节'), '修复看门狗重启');
  assert.equal(draftTitle(''), '新会话');
  assert.equal(draftTitle('a'.repeat(40)), `${'a'.repeat(24)}…`);
  assert.equal(draftTitle('\n\n真正的第一行'), '真正的第一行');
});

test('projects default to expanded, honor saved collapse, and show More only beyond five sessions', async () => {
  const { projectSections } = await import('../src/features/sessions/inbox.ts');
  for (const count of [0, 5, 6]) {
    const data = catalog([
      ...Array.from({ length: count }, (_, i) =>
        session(`s${i}`, 'completed', {
          createdAt: `2026-09-0${i + 1}T10:00:00Z`,
        }),
      ),
      session('archived', 'completed', { archived: true }),
    ]);
    assert.equal(projectSections(data, ACCENT)[0].headerExpanded, true);
    assert.equal(
      projectSections(data, ACCENT)[0].rows.length,
      Math.min(count, 5) + (count > 5 ? 1 : 0),
    );
    const [group] = projectSections(data, ACCENT, { p1: true });
    assert.equal(group.headerExpanded, true);
    assert.equal(group.headerActionId, 'toggle:p1');
    assert.equal(
      group.rows.some((row) => row.title === '更多'),
      count > 5,
    );
    assert.deepEqual(
      group.rows.filter((row) => row.id !== 'project:p1').map((row) => row.id),
      Array.from({ length: Math.min(count, 5) }, (_, i) => `s${count - i - 1}`),
    );
    if (count > 5) assert.equal(group.rows.at(-1).id, 'project:p1');
    if (!count) assert.equal(group.footer, '暂无会话');
    assert.equal(
      projectSections(data, ACCENT, { p1: false })[0].rows.length,
      0,
    );
  }
});

test('search finds empty projects and archived sessions without the inbox limit', async () => {
  const { searchSections } = await import('../src/features/sessions/inbox.ts');
  const data = catalog(
    Array.from({ length: 25 }, (_, i) =>
      session(`work-${i}`, 'completed', { archived: true }),
    ),
    [
      { id: 'p1', name: 'Lody' },
      { id: 'p2', name: 'Lody empty' },
    ],
  );
  assert.deepEqual(searchSections(data, ' ', ACCENT), []);
  const found = searchSections(data, ' LODY ', ACCENT);
  assert.equal(found[0].rows.length, 2);
  assert.equal(found[1].rows.length, 25);
  assert.match(found[1].rows[0].subtitle, /已归档/);
});
