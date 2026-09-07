export type ItemSummary =
  | { itemId: string; rev: number; type: 'text'; text: string }
  | { itemId: string; rev: number; type: 'thought'; text: string }
  | {
      itemId: string;
      rev: number;
      type: 'tool_call';
      kind: string;
      title: string;
      status: string;
      path?: string;
      added?: number;
      removed?: number;
      hasDetail: boolean;
      permission?: { requestId: string; pending: boolean };
    }
  | {
      itemId: string;
      rev: number;
      type: 'plan';
      entries: { content: string; status: string; priority?: string }[];
    }
  | {
      itemId: string;
      rev: number;
      type: 'subagent_task';
      taskId: string;
      status: string;
      actor?: string;
      description?: string;
    }
  | { itemId: string; rev: number; type: string };

export type EntrySummary = {
  id: string;
  rev: number;
  role: string;
  status: string;
  finished: boolean;
  timestamp?: string;
  startedAt?: number;
  endedAt?: number;
  permissionWaitMs?: number;
  items: ItemSummary[];
  /** Per-turn file changes recorded by the machine, independent of tool-call content. */
  fileDiffs?: { path: string; add: number; del: number }[];
};

export type Envelope = {
  v: 1;
  status: string;
  reason?: string;
  revision: number;
  awaitingUserSince?: number;
  composer?: { modelId?: string; modeId?: string; effort?: string };
  entries: EntrySummary[];
};
