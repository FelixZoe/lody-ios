import { PlatformColor, useColorScheme } from 'react-native';
import { DarkTheme, DefaultTheme } from 'expo-router';
import { accent, type ThemeName } from './tokens';

export type ColorRole =
  | 'label'
  | 'secondaryLabel'
  | 'tertiaryLabel'
  | 'accent'
  | 'warning'
  | 'danger'
  | 'background'
  | 'card'
  | 'separator'
  | 'fill'
  | 'onAccent';

export function usePalette() {
  const theme: ThemeName = useColorScheme() === 'dark' ? 'dark' : 'light';
  return {
    theme,
    label: PlatformColor('label'),
    secondaryLabel: PlatformColor('secondaryLabel'),
    tertiaryLabel: PlatformColor('tertiaryLabel'),
    accent: accent[theme],
    warning: PlatformColor('systemOrange'),
    danger: PlatformColor('systemRed'),
    background: PlatformColor('systemGroupedBackground'),
    card: PlatformColor('secondarySystemGroupedBackground'),
    separator: PlatformColor('separator'),
    fill: PlatformColor('tertiarySystemFill'),
    onAccent: '#FFFFFF',
  } as const;
}

export type Palette = ReturnType<typeof usePalette>;

/** Navigation needs plain string colors; native surfaces use adaptive UIKit colors. */
export const navigationThemes = {
  light: {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: accent.light,
      background: '#F2F2F7',
      card: '#FFFFFF',
      text: '#000000',
      border: '#C6C6C8',
      notification: '#FF3B30',
    },
  },
  dark: {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      primary: accent.dark,
      background: '#000000',
      card: '#1C1C1E',
      text: '#FFFFFF',
      border: '#38383A',
      notification: '#FF453A',
    },
  },
} as const;
