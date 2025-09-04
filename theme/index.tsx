// theme/index.ts
import { Mode, palette, semanticColors } from './colors';
import { typeScale, type TextVariant } from './typography';

export type AppTheme = {
  mode: Mode;
  palette: typeof palette;
  colors: ReturnType<typeof semanticColors>;
  typography: typeof typeScale;
  defaultTextColorToken: keyof ReturnType<typeof semanticColors>;
};

export const createTheme = (mode: Mode = 'dark'): AppTheme => ({
  mode,
  palette,
  colors: semanticColors(mode),
  typography: typeScale,
  defaultTextColorToken: 'primary', // default your brand red for all text
});

// single export you can import anywhere
export const theme = createTheme('dark');

export type { TextVariant };
