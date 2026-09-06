import { requireNativeView } from 'expo';
import type { ComponentType } from 'react';
import type { ViewProps } from 'react-native';

export interface NativeSymbolButtonProps extends ViewProps {
  accessibilityName: string;
  /** SF Symbol name. */
  symbol: string;
  /** Filled capsule treatment; plain glyph otherwise. */
  prominent?: boolean;
  disabled?: boolean;
  /** Semantic name (warning/danger/secondary/tertiary) or a `#RRGGBB` value. */
  tint?: string;
  onPress: () => void;
}

const NativeView: ComponentType<
  Omit<NativeSymbolButtonProps, 'onPress'> & { onSymbolPress: () => void }
> = requireNativeView('LodyKit', 'LodySymbolButton');

export function NativeSymbolButton({
  onPress,
  ...props
}: NativeSymbolButtonProps) {
  return <NativeView {...props} onSymbolPress={onPress} />;
}
