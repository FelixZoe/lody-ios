import { memo, useState } from 'react';
import {
  Linking,
  Pressable,
  Text,
  View,
  ActivityIndicator,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import { usePalette } from '@/ui/theme';
export type Message = {
  id: string;
  role: string;
  status: string;
  finished: boolean;
  items: { type: string; text: string; label: string }[];
};
const openLink = (url: string) => {
  try {
    if (['https:', 'http:'].includes(new URL(url).protocol))
      void Linking.openURL(url).catch(() => {});
  } catch {}
  return false;
};
export const MessageBubble = memo(function MessageBubble({
  message,
}: {
  message: Message;
}) {
  const colors = usePalette(),
    [expanded, setExpanded] = useState(false);
  const user = message.role === 'user';
  const thought = message.items
    .filter((b) => b.type === 'thought')
    .map((b) => b.text)
    .join('\n\n');
  const content = message.items.filter((b) => b.type !== 'thought');
  return (
    <View
      testID={`message-${message.id}`}
      style={{
        alignSelf: user ? 'flex-end' : 'stretch',
        maxWidth: user ? '90%' : '100%',
        gap: 10,
        marginVertical: 5,
      }}
    >
      {!user ? (
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 8,
              backgroundColor: colors.subtle,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}
            >
              L
            </Text>
          </View>
          <Text
            style={{ color: colors.muted, fontSize: 12, fontWeight: '600' }}
          >
            LODY
          </Text>
          {!message.finished ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : null}
        </View>
      ) : null}
      {thought ? (
        <View>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            onPress={() => setExpanded((v) => !v)}
            style={{ minHeight: 44, justifyContent: 'center' }}
          >
            <Text style={{ color: colors.muted, fontSize: 13 }}>
              {expanded ? '⌄' : '›'}　
              {message.finished ? '查看思考过程' : '正在思考'}
            </Text>
          </Pressable>
          {expanded ? (
            <Text
              selectable
              style={{
                color: colors.muted,
                fontSize: 14,
                lineHeight: 23,
                padding: 14,
                backgroundColor: colors.subtle,
                borderRadius: 12,
              }}
            >
              {thought.trim()}
            </Text>
          ) : null}
        </View>
      ) : null}
      <View
        style={{
          backgroundColor: user ? colors.subtle : 'transparent',
          borderRadius: 22,
          borderCurve: 'continuous',
          paddingHorizontal: user ? 16 : 0,
          paddingVertical: user ? 10 : 0,
          gap: 8,
        }}
      >
        {content.map((block, index) =>
          block.type === 'text' ? (
            user ? (
              <Text
                key={index}
                selectable
                style={{ color: colors.text, fontSize: 16, lineHeight: 25 }}
              >
                {block.text.trim()}
              </Text>
            ) : (
              <Markdown
                key={index}
                onLinkPress={openLink}
                rules={{
                  image: (node) => (
                    <Text key={node.key} style={{ color: colors.muted }}>
                      [图片：{node.attributes.alt || '请在电脑上查看'}]
                    </Text>
                  ),
                }}
                style={{
                  body: { color: colors.text, fontSize: 16, lineHeight: 26 },
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
                  link: { color: colors.primary },
                  code_inline: {
                    backgroundColor: colors.subtle,
                    color: colors.text,
                    fontFamily: 'Menlo',
                    fontSize: 13,
                  },
                  fence: {
                    backgroundColor: colors.subtle,
                    borderColor: colors.border,
                    borderRadius: 12,
                    padding: 14,
                    color: colors.text,
                    fontFamily: 'Menlo',
                    fontSize: 13,
                    lineHeight: 21,
                  },
                  blockquote: {
                    backgroundColor: colors.subtle,
                    borderColor: colors.primary,
                  },
                  hr: { backgroundColor: colors.border },
                  table: { borderColor: colors.border },
                  tr: { borderColor: colors.border },
                }}
              >
                {block.text}
              </Markdown>
            )
          ) : (
            <View
              key={index}
              style={{
                padding: 12,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
              }}
            >
              <Text style={{ color: colors.muted, fontSize: 13 }}>
                {block.label || block.type}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>
                完整内容可在电脑上查看
              </Text>
            </View>
          ),
        )}
      </View>
      {user && ['pending', 'seen', 'processing'].includes(message.status) ? (
        <Text style={{ color: colors.muted, fontSize: 11, textAlign: 'right' }}>
          {message.status === 'pending' ? '等待接收' : '正在处理'}
        </Text>
      ) : null}
    </View>
  );
});
