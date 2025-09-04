// components/ThemedText.tsx
import React, { useMemo } from 'react';
import { Text, TextProps, TextStyle } from 'react-native';
import { theme, type TextVariant } from '../theme';

type ColorToken = keyof typeof theme.colors;
type ThemedTextProps = TextProps & {
  variant?: TextVariant;                 // e.g. 'title', 'body', 'caption'
  color?: ColorToken;                    // e.g. 'primary', 'text', 'mutedText', 'success'
  weight?: '400' | '500' | '600' | '700' | '800';
  align?: 'auto' | 'left' | 'right' | 'center' | 'justify';
  uppercase?: boolean;
};

export function ThemedText(props: ThemedTextProps) {
  const {
    style,
    variant = 'body',
    color = theme.defaultTextColorToken, // defaults to your brand color
    weight,
    align,
    uppercase,
    ...rest
  } = props;

  const computedStyle = useMemo<TextStyle>(() => {
    const base = theme.typography[variant];
    return {
      ...base,
      color: theme.colors[color],
      fontWeight: weight ?? base.fontWeight,
      textAlign: align,
      textTransform: uppercase ? 'uppercase' : undefined,
      letterSpacing: base.letterSpacing,
    };
  }, [variant, color, weight, align, uppercase]);

  // Keep your original behavior: computed style applied last enforces color by default
  return <Text {...rest} style={[style, computedStyle]} />;
}