import { requireNativeView } from 'expo';
import type { ComponentType } from 'react';
import type { NativeSyntheticEvent, ViewProps } from 'react-native';

export type NativeMenuItem = {
  id: string;
  title: string;
  subtitle?: string;
  image?: string;
  selected?: boolean;
};

export interface NativeMenuButtonProps extends ViewProps {
  accessibilityName?: string;
  items: NativeMenuItem[];
  label: string;
  onSelect: (id: string) => void;
}

const NativeView: ComponentType<
  Omit<NativeMenuButtonProps, 'onSelect'> & {
    onSelect: (event: NativeSyntheticEvent<{ id: string }>) => void;
  }
> = requireNativeView('LodyKit', 'LodyMenuButton');

export function NativeMenuButton({
  onSelect,
  ...props
}: NativeMenuButtonProps) {
  return (
    <NativeView
      {...props}
      onSelect={({ nativeEvent }) => onSelect(nativeEvent.id)}
    />
  );
}
