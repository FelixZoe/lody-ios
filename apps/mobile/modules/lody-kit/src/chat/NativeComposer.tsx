import { requireNativeView } from 'expo';
import { useState, type ComponentProps, type ComponentType } from 'react';
import type { NativeSyntheticEvent, ViewProps } from 'react-native';
import type { NativeChat } from './NativeChat';

type Props = ViewProps &
  Pick<
    ComponentProps<typeof NativeChat>,
    | 'composerJSON'
    | 'composerOptionsJSON'
    | 'restoreDraftToken'
    | 'onSend'
    | 'onComposerOptionChange'
  >;

const ComposerView: ComponentType<
  Props & {
    onHeightChange: (event: NativeSyntheticEvent<{ height: number }>) => void;
  }
> = requireNativeView('LodyKit', 'LodyComposerView');

export function NativeComposer({ style, ...props }: Props) {
  const [height, setHeight] = useState(80);
  return (
    <ComposerView
      {...props}
      style={[style, { height }]}
      onHeightChange={({ nativeEvent }) => setHeight(nativeEvent.height)}
    />
  );
}
