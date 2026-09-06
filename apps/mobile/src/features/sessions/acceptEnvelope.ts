export type EnvelopeCursor = { generation: number; revision: number };

export function acceptEnvelope(
  cursor: EnvelopeCursor,
  event: { generation: number },
  data: { v?: unknown; revision?: unknown },
): 'accept' | 'reset' | 'drop' {
  if (data.v !== 1) return 'drop';
  if (event.generation < cursor.generation) return 'drop';
  if (event.generation > cursor.generation) return 'reset';
  return typeof data.revision === 'number' && data.revision > cursor.revision
    ? 'accept'
    : 'drop';
}
