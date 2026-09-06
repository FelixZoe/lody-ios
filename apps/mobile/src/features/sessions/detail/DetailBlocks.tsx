import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { usePalette } from '@/theme/palette';
import { AppText } from '@/ui/AppText';

export type DetailBlock = {
  type: string;
  path?: string;
  oldText?: string;
  newText?: string;
  command?: string;
  args?: string[];
  cwd?: string;
  output?: string;
  exitStatus?: { exitCode?: number | null; signal?: string | null };
};

export type DetailResponse = {
  itemId: string;
  rev: number;
  blocks: DetailBlock[];
  rawInput?: unknown;
  rawOutput?: unknown;
  options?: { optionId: string; name: string; kind: string }[];
  outcome?: unknown;
  truncated: boolean;
  nextCursor?: string;
};

function diffLines(block: DetailBlock) {
  const before = (block.oldText ?? '').split('\n');
  const after = (block.newText ?? '').split('\n');
  const removed = new Set(after);
  const added = new Set(before);
  const lines: { mark: ' ' | '+' | '−'; text: string }[] = [];
  for (const line of before)
    if (!removed.has(line)) lines.push({ mark: '−', text: line });
  for (const line of after)
    lines.push({ mark: added.has(line) ? ' ' : '+', text: line });
  return lines;
}

function Mono({ children, color }: { children: string; color?: unknown }) {
  return (
    <AppText
      variant="mono"
      selectable
      style={color ? { color: color as string } : undefined}
    >
      {children}
    </AppText>
  );
}

export function DiffBlock({ block }: { block: DetailBlock }) {
  const colors = usePalette();
  return (
    <View style={{ gap: 6 }}>
      {block.path ? <AppText variant="meta">{block.path}</AppText> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          {diffLines(block).map((line, index) => (
            <View
              key={index}
              style={{
                flexDirection: 'row',
                backgroundColor:
                  line.mark === '+'
                    ? `${colors.accent}22`
                    : line.mark === '−'
                      ? 'rgba(255,59,48,0.15)'
                      : undefined,
                paddingHorizontal: 6,
              }}
            >
              <Mono>{`${line.mark} ${line.text}`}</Mono>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

export function CommandBlock({ block }: { block: DetailBlock }) {
  return (
    <View style={{ gap: 2 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Mono>{`$ ${[block.command, ...(block.args ?? [])].join(' ')}`}</Mono>
      </ScrollView>
      {block.cwd ? <AppText variant="meta">{block.cwd}</AppText> : null}
    </View>
  );
}

export function OutputBlock({ block }: { block: DetailBlock }) {
  const colors = usePalette();
  const code = block.exitStatus?.exitCode;
  return (
    <View
      style={{
        backgroundColor: colors.fill,
        borderRadius: 12,
        borderCurve: 'continuous',
        padding: 12,
        gap: 6,
      }}
    >
      {typeof code === 'number' && code !== 0 ? (
        <AppText variant="meta" style={{ color: colors.danger }}>
          退出码 {code}
        </AppText>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Mono>{block.output ?? ''}</Mono>
      </ScrollView>
    </View>
  );
}

export function RawBlock({ title, value }: { title: string; value: unknown }) {
  const [expanded, setExpanded] = useState(false);
  const colors = usePalette();
  if (value === undefined) return null;
  return (
    <View style={{ gap: 6 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((v) => !v)}
        style={{ minHeight: 44, justifyContent: 'center' }}
      >
        <AppText variant="meta" style={{ color: colors.accent }}>
          {expanded ? `收起${title}` : `查看${title}`}
        </AppText>
      </Pressable>
      {expanded ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Mono>{JSON.stringify(value, null, 2)}</Mono>
        </ScrollView>
      ) : null}
    </View>
  );
}

export function Blocks({ blocks }: { blocks: DetailBlock[] }) {
  return (
    <>
      {blocks.map((block, index) =>
        block.type === 'diff' ? (
          <DiffBlock key={index} block={block} />
        ) : block.type === 'terminal_command' ? (
          <CommandBlock key={index} block={block} />
        ) : block.type === 'terminal_output' ? (
          <OutputBlock key={index} block={block} />
        ) : (
          <Mono key={index}>{JSON.stringify(block, null, 2)}</Mono>
        ),
      )}
    </>
  );
}
