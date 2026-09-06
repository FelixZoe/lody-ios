export type ListStateInput = {
  loading?: boolean;
  filtered?: boolean;
  connected?: boolean;
};

/** One placeholder for loading, empty search, offline and first run. */
export function listPlaceholder({
  loading = false,
  filtered = false,
  connected = true,
}: ListStateInput) {
  if (loading) return '正在载入你的会话…';
  if (filtered) return '没有匹配的会话';
  if (!connected) return '连接已中断，下拉重试。';
  return '会话会在连接电脑后出现在这里';
}
