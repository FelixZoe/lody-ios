import type { TextProps } from 'react-native';
import { StyleSheet, Text, useWindowDimensions } from 'react-native';
import {
  clampFontScale,
  type TypeRole,
  type as typeScale,
} from '@/theme/tokens';
import { type ColorRole, usePalette } from '@/theme/palette';

const roleColor: Record<TypeRole, ColorRole> = {
  title: 'label',
  body: 'label',
  secondary: 'secondaryLabel',
  meta: 'secondaryLabel',
  eyebrow: 'secondaryLabel',
  mono: 'label',
};

export type AppTextProps = Omit<TextProps, 'allowFontScaling'> & {
  variant?: TypeRole;
};

export function AppText({ variant = 'body', style, ...rest }: AppTextProps) {
  const palette = usePalette();
  const scale = typeScale[variant];
  const fontScale = clampFontScale(useWindowDimensions().fontScale);
  const override = StyleSheet.flatten(style);
  const size =
    (typeof override?.fontSize === 'number' ? override.fontSize : scale.size) *
    fontScale;
  const lineHeight =
    (typeof override?.lineHeight === 'number'
      ? override.lineHeight
      : scale.lineHeight) * fontScale;

  return (
    <Text
      allowFontScaling={false}
      style={[
        {
          color: palette[roleColor[variant]],
          letterSpacing: 'letterSpacing' in scale ? scale.letterSpacing : 0,
          fontFamily: variant === 'mono' ? 'Menlo' : undefined,
          fontWeight:
            variant === 'title' || variant === 'eyebrow' ? '600' : undefined,
          textTransform: variant === 'eyebrow' ? 'uppercase' : undefined,
        },
        override,
        { fontSize: size, lineHeight },
      ]}
      {...rest}
    />
  );
}
