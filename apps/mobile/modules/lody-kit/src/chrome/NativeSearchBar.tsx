import { requireNativeView } from 'expo';
import type { ComponentType } from 'react';
import type { NativeSyntheticEvent, ViewProps } from 'react-native';

export const NativeSearchBar: ComponentType<
  ViewProps & {
    placeholder: string;
    focused: boolean;
    onQueryChange: (event: NativeSyntheticEvent<{ text: string }>) => void;
    onClose: () => void;
  }
> = requireNativeView('LodyKit', 'LodySearchBar');
