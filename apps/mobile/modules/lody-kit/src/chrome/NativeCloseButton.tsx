import { requireNativeView } from 'expo';
import type { ComponentType } from 'react';
import type { ViewProps } from 'react-native';

export interface NativeCloseButtonProps extends ViewProps {
  label?: string;
  onPress: () => void;
}
const NativeView: ComponentType<
  Omit<NativeCloseButtonProps, 'onPress'> & { onClose: () => void }
> = requireNativeView('LodyKit', 'LodyCloseButton');
export function NativeCloseButton({
  onPress,
  ...props
}: NativeCloseButtonProps) {
  return <NativeView {...props} onClose={onPress} />;
}
