import { requireNativeView } from 'expo';
import type { ComponentType } from 'react';
import type { NativeSyntheticEvent, ViewProps } from 'react-native';

export type NativeListRow = {
  id: string;
  title: string;
  subtitle?: string;
  /** Paths, branches and ids read as data, not prose. */
  subtitleMono?: boolean;
  value?: string;
  image?: string;
  /** Semantic name (warning/danger/secondary/tertiary) or a `#RRGGBB` value. */
  imageTint?: string;
  action?: boolean;
  disclosure?: boolean;
  navigates?: boolean;
  destructive?: boolean;
};

export type NativeListSection = {
  id: string;
  header?: string;
  headerValue?: string;
  headerActionId?: string;
  headerExpanded?: boolean;
  footer?: string;
  rows: NativeListRow[];
};

export const NativeGroupedList: ComponentType<
  ViewProps & {
    sections: NativeListSection[];
    segments?: string[];
    selectedSegment?: number;
    onSegmentChange?: (event: NativeSyntheticEvent<{ index: number }>) => void;
    /** Default row tint; `#RRGGBB`. Rows may override with `imageTint`. */
    accent?: string;
    /** Drop the list's own background so a sheet's material shows through. */
    transparent?: boolean;
    /** Project sections with tappable headings and compact session details. */
    contentStyle?: boolean;
    placeholder?: string;
    refreshing?: boolean;
    onRefresh?: () => void;
    onRowPress: (event: NativeSyntheticEvent<{ id: string }>) => void;
  }
> = requireNativeView('LodyKit', 'LodyGroupedList');
