// theme/typography.ts
export type TextVariant =
  | 'display'
  | 'h1'
  | 'h2'
  | 'title'
  | 'subtitle'
  | 'body'
  | 'callout'
  | 'caption'
  | 'overline';

export const fontFamilies = {
  regular: 'System',
  medium: 'System',
  bold: 'System',
};

export const typeScale: Record<TextVariant, {
  fontSize: number;
  lineHeight: number;
  letterSpacing?: number;
  fontFamily?: string;
  fontWeight?: '400' | '500' | '600' | '700' | '800';
}> = {
  display:  { fontSize: 34, lineHeight: 40, fontFamily: fontFamilies.bold,   fontWeight: '700' },
  h1:       { fontSize: 28, lineHeight: 34, fontFamily: fontFamilies.bold,   fontWeight: '700' },
  h2:       { fontSize: 24, lineHeight: 30, fontFamily: fontFamilies.medium, fontWeight: '600' },
  title:    { fontSize: 20, lineHeight: 26, fontFamily: fontFamilies.medium, fontWeight: '600' },
  subtitle: { fontSize: 16, lineHeight: 22, fontFamily: fontFamilies.regular, fontWeight: '500' },
  body:     { fontSize: 16, lineHeight: 22, fontFamily: fontFamilies.regular, fontWeight: '400' },
  callout:  { fontSize: 15, lineHeight: 20, fontFamily: fontFamilies.regular, fontWeight: '500' },
  caption:  { fontSize: 13, lineHeight: 18, fontFamily: fontFamilies.regular, fontWeight: '400' },
  overline: { fontSize: 11, lineHeight: 14, letterSpacing: 0.5, fontFamily: fontFamilies.medium, fontWeight: '600' },
};