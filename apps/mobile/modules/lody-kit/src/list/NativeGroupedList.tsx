import { requireNativeView } from 'expo';
import type { ComponentType } from 'react';
import type { NativeSyntheticEvent, ViewProps } from 'react-native';
export type NativeListRow = {
  id: string;
  title: string;
  subtitle?: string;
  action?: boolean;
  disclosure?: boolean;
  navigates?: boolean;
  destructive?: boolean;
};
export const NativeGroupedList: ComponentType<
  ViewProps & {
    sections: NativeListRow[][];
    onRowPress: (event: NativeSyntheticEvent<{ id: string }>) => void;
  }
> = requireNativeView('LodyKit', 'LodyGroupedList');
