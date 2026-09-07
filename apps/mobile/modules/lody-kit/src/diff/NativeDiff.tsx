import { requireNativeView } from 'expo';
import type { ComponentType } from 'react';
import type { NativeSyntheticEvent, ViewProps } from 'react-native';

export type NativeDiffProps = ViewProps & {
  path: string;
  /** Inline contents; omitted when `handle` names parked content. */
  oldText?: string;
  newText?: string;
  /** A ContentStore handle from `turnDiff`, `fileDiff` or `readFile`. */
  handle?: string;
  diffStyle?: 'unified' | 'split';
  /** Off when an outer sheet scrolls; the view then reports its full height. */
  scrollEnabled?: boolean;
  onRender?: (
    event: NativeSyntheticEvent<{ fileCount: number; contentHeight: number }>,
  ) => void;
  onFail?: (event: NativeSyntheticEvent<{ message: string }>) => void;
};

export const NativeDiff: ComponentType<NativeDiffProps> = requireNativeView(
  'LodyKit',
  'LodyDiffView',
);
