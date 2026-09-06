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
  submitDisabled = false,
  testID,
  inputAccessoryViewID,
}: {
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  editable?: boolean;
  sending?: boolean;
  submitDisabled?: boolean;
  testID?: string;
  inputAccessoryViewID?: string;
}) {
  const colors = usePalette();
  const canSend =
    editable && !submitDisabled && !sending && value.trim().length > 0;
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
        inputAccessoryViewID={inputAccessoryViewID}
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
          // No lineHeight: RN maps it to minimumLineHeight on iOS multiline
          // inputs, which pads above the text and stretches the caret.
          // Match the send button's height so a single line centers with it;
          // flex-end then grows the field upward as the text wraps.
          paddingTop: 12,
          paddingBottom: 12,
          minHeight: 44,
          maxHeight: 140,
        }}
      />
      {sending ? (
        <View
          style={{
            width: 44,
            height: 44,
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
          style={{ width: 44, height: 44 }}
        />
      )}
    </View>
  );
}
