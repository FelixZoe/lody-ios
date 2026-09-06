import { usePalette } from '@/theme/palette';
import { AppText } from '@/ui/AppText';
import { CopyMenu } from './CopyMenu';

export function UserBubble({ text }: { text: string }) {
  const colors = usePalette();
  return (
    <CopyMenu
      text={text}
      style={{
        alignSelf: 'flex-end',
        maxWidth: '80%',
        backgroundColor: colors.fill,
        borderRadius: 19,
        borderCurve: 'continuous',
        paddingHorizontal: 13,
        paddingVertical: 8,
      }}
    >
      <AppText variant="body" selectable>
        {text.trim()}
      </AppText>
    </CopyMenu>
  );
}
