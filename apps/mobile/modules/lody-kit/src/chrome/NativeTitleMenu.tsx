import { requireNativeView } from 'expo';
import type { ComponentType } from 'react';
import type { NativeSyntheticEvent, ViewProps } from 'react-native';

export type NativeTitleMenuItem = {
  id: string;
  title: string;
  selected?: boolean;
};

export interface NativeTitleMenuProps extends ViewProps {
  accessibilityName: string;
  label: string;
  items: NativeTitleMenuItem[];
  onSelect: (id: string) => void;
}

const NativeView: ComponentType<
  Omit<NativeTitleMenuProps, 'onSelect'> & {
    onSelect: (event: NativeSyntheticEvent<{ id: string }>) => void;
  }
> = requireNativeView('LodyKit', 'LodyTitleMenu');

export function NativeTitleMenu({ onSelect, ...props }: NativeTitleMenuProps) {
  return (
    <NativeView
      {...props}
      onSelect={({ nativeEvent }) => onSelect(nativeEvent.id)}
    />
  );
}
