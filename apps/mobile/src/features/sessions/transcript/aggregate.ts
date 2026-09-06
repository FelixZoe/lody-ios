import type { ItemSummary } from './types.ts';

export type PlanEntry = { content: string; status: string; priority?: string };

export type Row =
  | { kind: 'prose'; itemId: string; rev: number; text: string }
  | { kind: 'thought'; itemId: string; rev: number; text: string }
  | { kind: 'plan'; itemId: string; rev: number; entries: PlanEntry[] }
  | { kind: 'task'; itemId: string; rev: number; label: string; status: string }
  | {
      kind: 'activity';
      itemId: string;
      rev: number;
      symbol: string;
      label: string;
      running: boolean;
      failed: boolean;
      hasDetail: boolean;
      pendingPermission?: string;
      members: string[];
    };

const CATEGORIES = {
  read: { symbol: 'doc.text.magnifyingglass', label: '读取了文件' },
  edit: { symbol: 'square.and.pencil', label: '编辑了文件' },
  execute: { symbol: 'terminal', label: '执行了命令' },
  fetch: { symbol: 'globe', label: '访问了网络' },
  tool: { symbol: 'wrench.and.screwdriver', label: '调用了工具' },
} as const;

type Category = keyof typeof CATEGORIES;

const KIND_TO_CATEGORY: Record<string, Category> = {
  read: 'read',
  search: 'read',
  edit: 'edit',
  write: 'edit',
  move: 'edit',
  delete: 'edit',
  execute: 'execute',
  bash: 'execute',
  fetch: 'fetch',
  mcp: 'tool',
  other: 'tool',
  computer: 'tool',
  think: 'tool',
  switch_mode: 'tool',
};

type Tool = Extract<ItemSummary, { type: 'tool_call' }>;

function categoryOf(item: ItemSummary): Category {
  return item.type === 'tool_call'
    ? (KIND_TO_CATEGORY[(item as Tool).kind] ?? 'tool')
    : 'tool';
}

function editLabel(item: Tool) {
  const parts = [`编辑了 ${item.path}`];
  if (item.added) parts.push(`+${item.added}`);
  if (item.removed) parts.push(`−${item.removed}`);
  return parts.join(' ');
}

function activityRow(group: ItemSummary[]): Row {
  const categories: Category[] = [];
  for (const item of group) {
    const category = categoryOf(item);
    if (!categories.includes(category)) categories.push(category);
  }
  const tools = group.filter((i): i is Tool => i.type === 'tool_call');
  const failed = tools.some((t) => t.status === 'failed');
  const running = tools.some((t) => t.status === 'in_progress');
  const only = group.length === 1 ? tools[0] : undefined;
  const label = failed
    ? `失败：${categories.map((c) => CATEGORIES[c].label).join('、')}`
    : only && categories[0] === 'edit' && only.path
      ? editLabel(only)
      : categories
          .slice(0, 3)
          .map((c) => CATEGORIES[c].label)
          .join('、') + (categories.length > 3 ? '等' : '');
  return {
    kind: 'activity',
    itemId: group[0].itemId,
    rev: group.reduce((sum, i) => sum + i.rev, 0),
    symbol:
      categories.length === 1
        ? CATEGORIES[categories[0]].symbol
        : CATEGORIES.tool.symbol,
    label,
    running,
    failed,
    hasDetail: tools.some((t) => t.hasDetail),
    pendingPermission: tools.find((t) => t.permission?.pending)?.permission
      ?.requestId,
    members: group.map((i) => i.itemId),
  };
}

export function aggregate(items: ItemSummary[]): Row[] {
  const rows: Row[] = [];
  let group: ItemSummary[] = [];
  const flush = () => {
    if (group.length) rows.push(activityRow(group));
    group = [];
  };
  for (const item of items) {
    if (item.type === 'text' || item.type === 'thought') {
      flush();
      rows.push({
        kind: item.type === 'text' ? 'prose' : 'thought',
        itemId: item.itemId,
        rev: item.rev,
        text: 'text' in item ? item.text : '',
      });
    } else if (item.type === 'plan') {
      flush();
      rows.push({
        kind: 'plan',
        itemId: item.itemId,
        rev: item.rev,
        entries: 'entries' in item ? item.entries : [],
      });
    } else if (item.type === 'subagent_task') {
      flush();
      const task = item as Extract<ItemSummary, { type: 'subagent_task' }>;
      rows.push({
        kind: 'task',
        itemId: item.itemId,
        rev: item.rev,
        label: task.description || task.actor || task.taskId,
        status: task.status,
      });
    } else group.push(item);
  }
  flush();
  return rows;
}
