import type { ReactNode } from 'react';
import { Clipboard, type StyleProp, type ViewStyle } from 'react-native';
import { NativeContextMenu } from '@lody-ios/kit';

export function CopyMenu({
  text,
  children,
  style,
}: {
  text: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <NativeContextMenu
      style={style}
      actions={[{ id: 'copy', title: '拷贝', symbol: 'doc.on.doc' }]}
      onAction={({ nativeEvent }) => {
        if (nativeEvent.id === 'copy') Clipboard.setString(text);
      }}
    >
      {children}
    </NativeContextMenu>
  );
}
