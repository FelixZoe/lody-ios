import { Linking, Text } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { usePalette } from '@/theme/palette';

const openLink = (url: string) => {
  try {
    if (['https:', 'http:'].includes(new URL(url).protocol))
      void Linking.openURL(url).catch(() => {});
  } catch {}
  return false;
};

export function MarkdownBody({ children }: { children: string }) {
  const colors = usePalette();
  return (
    <Markdown
      onLinkPress={openLink}
      rules={{
        image: (node) => (
          <Text key={node.key} style={{ color: colors.secondaryLabel }}>
            [图片：{node.attributes.alt || '请在电脑上查看'}]
          </Text>
        ),
      }}
      style={{
        body: { color: colors.label, fontSize: 16, lineHeight: 26 },
        paragraph: { marginTop: 0, marginBottom: 12 },
        heading1: {
          fontSize: 25,
          lineHeight: 33,
          marginTop: 16,
          marginBottom: 10,
          fontWeight: '700',
        },
        heading2: {
          fontSize: 21,
          lineHeight: 29,
          marginTop: 14,
          marginBottom: 8,
          fontWeight: '600',
        },
        heading3: { fontSize: 18, lineHeight: 26, fontWeight: '600' },
        link: { color: colors.accent },
        code_inline: {
          backgroundColor: colors.fill,
          color: colors.label,
          fontFamily: 'Menlo',
          fontSize: 13,
        },
        fence: {
          backgroundColor: colors.fill,
          borderColor: colors.separator,
          borderRadius: 12,
          padding: 14,
          color: colors.label,
          fontFamily: 'Menlo',
          fontSize: 13,
          lineHeight: 21,
        },
        blockquote: {
          backgroundColor: colors.fill,
          borderColor: colors.accent,
        },
        hr: { backgroundColor: colors.separator },
        table: { borderColor: colors.separator },
        tr: { borderColor: colors.separator },
      }}
    >
      {children}
    </Markdown>
  );
}
