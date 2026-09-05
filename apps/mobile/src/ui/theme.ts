import { DarkTheme, DefaultTheme } from 'expo-router';
import { PlatformColor } from 'react-native';
export const lightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#007AFF',
    background: '#F2F2F7',
    card: '#FFFFFF',
    text: '#000000',
    border: '#C6C6C8',
    notification: '#FF3B30',
  },
};
export const darkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: '#0A84FF',
    background: '#000000',
    card: '#1C1C1E',
    text: '#FFFFFF',
    border: '#38383A',
    notification: '#FF453A',
  },
};
// Navigation requires string colors; native surfaces use adaptive UIKit colors.
export function usePalette() {
  return {
    primary: PlatformColor('systemBlue'),
    background: PlatformColor('systemGroupedBackground'),
    card: PlatformColor('secondarySystemGroupedBackground'),
    text: PlatformColor('label'),
    border: PlatformColor('separator'),
    notification: PlatformColor('systemRed'),
    muted: PlatformColor('secondaryLabel'),
    subtle: PlatformColor('tertiarySystemFill'),
    onAccent: '#FFFFFF',
  };
}
export function sessionStatus(status: string) {
  return (
    (
      {
        idle: '待命',
        running: '进行中',
        processing: '进行中',
        completed: '已完成',
        waiting: '等待确认',
        error: '需要关注',
        pending: '等待处理',
        unknown: '会话',
      } as Record<string, string>
    )[status] ?? '会话'
  );
}
