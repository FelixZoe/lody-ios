import { requireNativeView } from 'expo';
import type { ComponentType } from 'react';
import type { NativeSyntheticEvent, ViewProps } from 'react-native';

export const NativeChat: ComponentType<
  ViewProps & {
    entriesJSON: string;
    attachmentContextJSON?: string;
    navigationTitle?: string;
    onTitlePress?: () => void;
    processEntryId?: string;
    processStartId?: string;
    composerJSON: string;
    initialDraft?: string;
    clearDraftToken: number;
    restoreDraftToken?: number;
    emptyText: string;
    onSend: (
      event: NativeSyntheticEvent<{
        text: string;
        attachments: {
          id: string;
          name: string;
          uri: string;
          kind: 'image' | 'file';
        }[];
      }>,
    ) => void;
    onActivityPress: (
      event: NativeSyntheticEvent<{
        entryId: string;
        itemId: string;
        processStartId?: string;
      }>,
    ) => void;
    onReconnect: () => void;
  }
> = requireNativeView('LodyKit', 'LodyChatView');
