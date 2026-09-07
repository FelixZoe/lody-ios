import { requireNativeView } from 'expo';
import type { ComponentType } from 'react';
import type { NativeSyntheticEvent, ViewProps } from 'react-native';

export type NativeCodeViewProps = ViewProps & {
  /** A ContentStore handle from `readFile`. */
  handle: string;
  path: string;
  onFail?: (event: NativeSyntheticEvent<{ message: string }>) => void;
};

export const NativeCodeView: ComponentType<NativeCodeViewProps> =
  requireNativeView('LodyKit', 'LodyCodeView');
