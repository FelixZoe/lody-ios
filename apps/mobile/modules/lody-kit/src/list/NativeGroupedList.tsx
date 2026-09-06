import { requireNativeView } from 'expo';
import type { ComponentType } from 'react';
import type { NativeSyntheticEvent, ViewProps } from 'react-native';

export type NativeListRow = {
  id: string;
  title: string;
  subtitle?: string;
  value?: string;
  image?: string;
  action?: boolean;
  disclosure?: boolean;
  navigates?: boolean;
  destructive?: boolean;
};

export type NativeListSection = {
  id: string;
  header?: string;
  footer?: string;
  rows: NativeListRow[];
};

export const NativeGroupedList: ComponentType<
  ViewProps & {
    sections: NativeListSection[];
    placeholder?: string;
    refreshing?: boolean;
    onRefresh?: () => void;
    onRowPress: (event: NativeSyntheticEvent<{ id: string }>) => void;
  }
> = requireNativeView('LodyKit', 'LodyGroupedList');
