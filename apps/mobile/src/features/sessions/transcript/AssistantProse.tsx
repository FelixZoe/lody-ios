import { MarkdownBody } from '@/ui/MarkdownBody';
import { CopyMenu } from './CopyMenu';

export function AssistantProse({ text }: { text: string }) {
  return (
    <CopyMenu text={text} style={{ alignSelf: 'stretch' }}>
      <MarkdownBody>{text}</MarkdownBody>
    </CopyMenu>
  );
}
