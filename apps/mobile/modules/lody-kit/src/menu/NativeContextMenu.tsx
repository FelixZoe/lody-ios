import { requireNativeView } from 'expo';
import type { ComponentType, ReactNode } from 'react';
import type { NativeSyntheticEvent, StyleProp, ViewStyle } from 'react-native';

export type NativeContextMenuAction = {
  id: string;
  title: string;
  symbol?: string;
  destructive?: boolean;
};

export type NativeContextMenuProps = {
  actions: NativeContextMenuAction[];
  onAction: (event: { nativeEvent: { id: string } }) => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

const NativeView: ComponentType<
  Omit<NativeContextMenuProps, 'onAction'> & {
    onAction: (event: NativeSyntheticEvent<{ id: string }>) => void;
  }
> = requireNativeView('LodyKit', 'LodyContextMenu');

export function NativeContextMenu(props: NativeContextMenuProps) {
  return <NativeView {...props} />;
}
