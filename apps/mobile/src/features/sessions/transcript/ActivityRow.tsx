import { ActivityIndicator, Pressable, View } from 'react-native';
import { NativeSymbolButton } from '@lody-ios/kit';
import { usePalette } from '@/theme/palette';
import { AppText } from '@/ui/AppText';

export function ActivityRow({
  symbol,
  label,
  running,
  failed,
  pendingPermission,
  disabled,
  onPress,
}: {
  symbol: string;
  label: string;
  running: boolean;
  failed: boolean;
  pendingPermission?: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const colors = usePalette();
  const text = pendingPermission ? '等待你的批准' : label;
  const color = pendingPermission
    ? colors.warning
    : failed
      ? colors.danger
      : colors.secondaryLabel;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={text}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 44,
        gap: 9,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <View pointerEvents="none" style={{ width: 28, height: 28 }}>
        <NativeSymbolButton
          accessibilityName={text}
          symbol={symbol}
          tint={pendingPermission ? 'warning' : failed ? 'danger' : 'secondary'}
          onPress={onPress}
          style={{ width: 28, height: 28 }}
        />
      </View>
      <AppText variant="meta" style={{ color, flexShrink: 1 }}>
        {text}
      </AppText>
      {running ? <ActivityIndicator size="small" /> : null}
      {disabled ? null : (
        <View pointerEvents="none" style={{ width: 20, height: 20 }}>
          <NativeSymbolButton
            accessibilityName=""
            symbol="chevron.right"
            tint="tertiary"
            onPress={onPress}
            style={{ width: 20, height: 20 }}
          />
        </View>
      )}
    </Pressable>
  );
}
