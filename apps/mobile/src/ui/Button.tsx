import { NativePressable } from '@lody-ios/kit';
import type { StyleProp, ViewStyle } from 'react-native';
import { usePalette } from '@/theme/palette';
import { AppText } from './AppText';

export type ButtonVariant = 'filled' | 'plain';

export function Button({
  label,
  children,
  onPress,
  variant = 'plain',
  disabled = false,
  testID,
  style,
}: {
  label?: string;
  children?: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = usePalette();
  const filled = variant === 'filled';
  const text = label ?? children ?? '';
  return (
    <NativePressable
      testID={testID}
      accessibilityLabel={text}
      disabled={disabled}
      onPress={onPress}
      style={[
        {
          minHeight: 44,
          paddingHorizontal: filled ? 20 : 0,
          borderRadius: filled ? 12 : 0,
          borderCurve: 'continuous',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: filled ? colors.accent : undefined,
          opacity: disabled ? 0.4 : 1,
        },
        style,
      ]}
    >
      <AppText
        variant="body"
        style={{
          color: filled ? colors.onAccent : colors.accent,
          fontWeight: filled ? '600' : '400',
        }}
      >
        {text}
      </AppText>
    </NativePressable>
  );
}
