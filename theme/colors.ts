// theme/colors.ts
export type Mode = 'light' | 'dark';

export const palette = {
  black: '#000000',
  white: '#FFFFFF',
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray400: '#9CA3AF',
  gray600: '#4B5563',
  gray800: '#1F2937',

  primary: '#fa260b',   // your brand color
  success: '#10B981',
  warning: '#F59E0B',
  error:   '#EF4444',
};

export const semanticColors = (mode: Mode) => ({
  background: mode === 'dark' ? '#1e1e1e' : palette.white,
  text: mode === 'dark' ? palette.gray100 : palette.gray800,
  mutedText: mode === 'dark' ? palette.gray400 : palette.gray600,

  // brand + statuses
  primary: palette.primary,
  success: palette.success,
  warning: palette.warning,
  error: palette.error,
});