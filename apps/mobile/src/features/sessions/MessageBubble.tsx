import { memo, useState } from 'react';
import {
  Linking,
  Pressable,
  Text,
  View,
  ActivityIndicator,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import { usePalette } from '@/theme/palette';
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
              backgroundColor: colors.fill,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{ color: colors.accent, fontWeight: '700', fontSize: 13 }}
            >
              L
            </Text>
          </View>
          <Text
            style={{
              color: colors.secondaryLabel,
              fontSize: 12,
              fontWeight: '600',
            }}
          >
            LODY
          </Text>
          {!message.finished ? (
            <ActivityIndicator size="small" color={colors.accent} />
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
            <Text style={{ color: colors.secondaryLabel, fontSize: 13 }}>
              {expanded ? '⌄' : '›'}　
              {message.finished ? '查看思考过程' : '正在思考'}
            </Text>
          </Pressable>
          {expanded ? (
            <Text
              selectable
              style={{
                color: colors.secondaryLabel,
                fontSize: 14,
                lineHeight: 23,
                padding: 14,
                backgroundColor: colors.fill,
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
          backgroundColor: user ? colors.fill : 'transparent',
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
                style={{ color: colors.label, fontSize: 16, lineHeight: 25 }}
              >
                {block.text.trim()}
              </Text>
            ) : (
              <Markdown
                key={index}
                onLinkPress={openLink}
                rules={{
                  image: (node) => (
                    <Text
                      key={node.key}
                      style={{ color: colors.secondaryLabel }}
                    >
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
                {block.text}
              </Markdown>
            )
          ) : (
            <View
              key={index}
              style={{
                padding: 12,
                borderWidth: 1,
                borderColor: colors.separator,
                borderRadius: 12,
              }}
            >
              <Text style={{ color: colors.secondaryLabel, fontSize: 13 }}>
                {block.label || block.type}
              </Text>
              <Text
                style={{
                  color: colors.secondaryLabel,
                  fontSize: 11,
                  marginTop: 4,
                }}
              >
                完整内容可在电脑上查看
              </Text>
            </View>
          ),
        )}
      </View>
      {user && ['pending', 'seen', 'processing'].includes(message.status) ? (
        <Text
          style={{
            color: colors.secondaryLabel,
            fontSize: 11,
            textAlign: 'right',
          }}
        >
          {message.status === 'pending' ? '等待接收' : '正在处理'}
        </Text>
      ) : null}
    </View>
  );
});
