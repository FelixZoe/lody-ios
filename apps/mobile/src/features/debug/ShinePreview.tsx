import { NativeChat } from '@lody-ios/kit';
import { definePage } from '@/presentation';

const entriesJSON = JSON.stringify([
  {
    id: 'user',
    role: 'user',
    status: 'completed',
    finished: true,
    items: [{ itemId: 'text', type: 'text', text: '看一下过程折叠的高光' }],
  },
  {
    id: 'reply',
    role: 'assistant',
    status: 'running',
    finished: false,
    items: [
      {
        itemId: 'read',
        type: 'tool_call',
        kind: 'read',
        title: '读取 SessionScreen.tsx',
        status: 'in_progress',
        hasDetail: true,
      },
    ],
  },
]);

function ShinePreview() {
  return (
    <NativeChat
      style={{ flex: 1 }}
      navigationTitle="过程高光"
      entriesJSON={entriesJSON}
      composerJSON={JSON.stringify({
        editable: false,
        canSend: false,
        sending: false,
        notice: '',
        reconnect: false,
        placeholder: '',
      })}
      clearDraftToken={0}
      emptyText=""
      onSend={() => {}}
      onActivityPress={() => {}}
      onReconnect={() => {}}
    />
  );
}

export const shinePreviewPage = definePage({
  id: 'chat-shine-preview',
  title: '过程高光',
  Component: ShinePreview,
  presentation: { style: 'push', headerVariant: 'transparent' },
});
