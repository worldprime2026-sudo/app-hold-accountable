import '@/global.css';

import { Platform } from 'react-native';

const playground = {
  text: '#F3ECDE',
  background: '#0E1311',
  backgroundElement: '#171E1B',
  backgroundSelected: '#24302A',
  textSecondary: '#9AA89F',
  lime: '#C6F54A',
  coral: '#FF7A59',
  ink: '#0E1311',
  onLime: '#12180F',
};

export const Colors = {
  light: playground,
  dark: playground,
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 72;
export const MaxContentWidth = 760;
export const PlaygroundBg = playground.background;
