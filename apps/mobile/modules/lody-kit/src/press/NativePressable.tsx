import { requireNativeView } from 'expo';
import type { ComponentType } from 'react';
import type { ViewProps } from 'react-native';

export interface NativePressableProps extends ViewProps {
  disabled?: boolean;
  haptic?: boolean;
  pressScale?: number;
  onPress: () => void;
}

const NativeView: ComponentType<
  Omit<NativePressableProps, 'onPress'> & { onNativePress: () => void }
> = requireNativeView('LodyKit', 'LodyPressable');

export function NativePressable({
  onPress,
  disabled = false,
  haptic = true,
  pressScale = 0.985,
  accessibilityRole = 'button',
  accessibilityState,
  ...rest
}: NativePressableProps) {
  return (
    <NativeView
      {...rest}
      accessible
      accessibilityRole={accessibilityRole}
      accessibilityState={{ ...accessibilityState, disabled }}
      disabled={disabled}
      haptic={haptic}
      pressScale={pressScale}
      onAccessibilityTap={disabled ? undefined : onPress}
      onNativePress={onPress}
    />
  );
}
