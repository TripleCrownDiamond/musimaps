/**
 * Bouton — primitive du socle mobile.
 *
 * Reflète les variantes du bouton web (`components/ui/button.tsx`) : mêmes
 * noms, même hiérarchie visuelle, mêmes tailles. Ce qui change, c'est le
 * moteur de rendu, pas le design.
 *
 * Chaque écran mobile réinventait son bouton en `StyleSheet` avec ses
 * couleurs et ses rayons écrits à la main — 91 couleurs en dur et 38 rayons
 * distincts dans l'app. Ici tout vient des tokens partagés.
 */
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { radii, spacing } from '@musimaps/shared';
import { useAppTheme } from '../context/ThemeContext';
import { fonts, type AppColors } from '../theme';

export type ButtonVariant =
  /** Action principale — bleu de marque. */
  | 'default'
  /** Action destructive. */
  | 'destructive'
  /** Contour, fond transparent. */
  | 'outline'
  /** Fond neutre. */
  | 'secondary'
  /** Sans fond ni contour. */
  | 'ghost'
  /** Texte souligné au pressé. */
  | 'link';

export type ButtonSize = 'sm' | 'default' | 'lg' | 'icon';

interface ButtonProps {
  children?: ReactNode;
  label?: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  /** Occupe toute la largeur disponible. */
  block?: boolean;
  icon?: ReactNode;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/** Hauteurs et espacements par taille — alignés sur l'échelle web. */
const SIZES: Record<ButtonSize, { height: number; paddingHorizontal: number; fontSize: number }> = {
  sm: { height: 34, paddingHorizontal: spacing.md, fontSize: 13 },
  default: { height: 42, paddingHorizontal: spacing.lg, fontSize: 14 },
  lg: { height: 50, paddingHorizontal: spacing['2xl'], fontSize: 15 },
  icon: { height: 42, paddingHorizontal: 0, fontSize: 14 },
};

export function Button({
  children,
  label,
  onPress,
  variant = 'default',
  size = 'default',
  disabled = false,
  loading = false,
  block = false,
  icon,
  accessibilityLabel,
  style,
}: ButtonProps) {
  const { colors } = useAppTheme();
  const dimensions = SIZES[size];
  const palette = variantPalette(variant, colors);
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          height: dimensions.height,
          paddingHorizontal: dimensions.paddingHorizontal,
          width: size === 'icon' ? dimensions.height : undefined,
          backgroundColor: palette.background,
          borderColor: palette.border,
          borderWidth: palette.border === 'transparent' ? 0 : 1.5,
          alignSelf: block ? 'stretch' : 'flex-start',
        },
        pressed && !inactive && styles.pressed,
        inactive && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={palette.text} />
      ) : (
        <View style={styles.content}>
          {icon}
          {label ? (
            <Text
              numberOfLines={1}
              style={[
                styles.label,
                {
                  color: palette.text,
                  fontSize: dimensions.fontSize,
                  textDecorationLine: variant === 'link' ? 'underline' : 'none',
                },
              ]}
            >
              {label}
            </Text>
          ) : null}
          {children}
        </View>
      )}
    </Pressable>
  );
}

/** Couleurs d'une variante — toutes issues des tokens, aucune en dur. */
function variantPalette(variant: ButtonVariant, colors: AppColors) {
  switch (variant) {
    case 'destructive':
      return { background: colors.danger, text: colors.white, border: 'transparent' };
    case 'outline':
      return { background: 'transparent', text: colors.ink, border: colors.line };
    case 'secondary':
      return { background: colors.surfaceMuted, text: colors.ink, border: 'transparent' };
    case 'ghost':
      return { background: 'transparent', text: colors.ink, border: 'transparent' };
    case 'link':
      return { background: 'transparent', text: colors.brandPrimary, border: 'transparent' };
    case 'default':
    default:
      return {
        background: colors.brandPrimary,
        text: colors.white,
        border: 'transparent',
      };
  }
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { fontFamily: fonts.bold },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.5 },
});
