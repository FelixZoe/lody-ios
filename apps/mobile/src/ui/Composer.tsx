import { ActivityIndicator, TextInput, View } from 'react-native';
import { NativeSymbolButton } from '@lody-ios/kit';
import { usePalette } from '@/theme/palette';
import { type as typeScale } from '@/theme/tokens';

export function Composer({
  placeholder,
  value,
  onChangeText,
  onSubmit,
  editable = true,
  sending = false,
  testID,
}: {
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  editable?: boolean;
  sending?: boolean;
  testID?: string;
}) {
  const colors = usePalette();
  const canSend = editable && !sending && value.trim().length > 0;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 8,
        backgroundColor: colors.card,
        borderRadius: 24,
        borderCurve: 'continuous',
        borderColor: colors.separator,
        borderWidth: 1,
        padding: 6,
        paddingLeft: 14,
      }}
    >
      <TextInput
        testID={testID}
        accessibilityLabel={placeholder}
        placeholder={placeholder}
        placeholderTextColor={colors.tertiaryLabel}
        multiline
        maxLength={32000}
        value={value}
        editable={editable && !sending}
        onChangeText={onChangeText}
        style={{
          flex: 1,
          color: colors.label,
          fontSize: typeScale.body.size,
          lineHeight: typeScale.body.lineHeight,
          paddingTop: 8,
          paddingBottom: 8,
          minHeight: typeScale.body.lineHeight + 16,
          maxHeight: 140,
        }}
      />
      {sending ? (
        <View
          style={{
            width: 36,
            height: 36,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <NativeSymbolButton
          accessibilityName="发送"
          symbol="arrow.up"
          prominent
          disabled={!canSend}
          tint={colors.accent}
          onPress={onSubmit}
          style={{ width: 36, height: 36 }}
        />
      )}
    </View>
  );
}
