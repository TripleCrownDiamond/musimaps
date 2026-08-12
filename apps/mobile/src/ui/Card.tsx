/**
 * Carte et libellé de champ — primitives du socle mobile.
 *
 * `Card` reflète `components/ui/card.tsx` côté web, `Field` reflète le
 * couple label + message d'erreur utilisé par les formulaires web.
 */
import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { radii, spacing } from '@musimaps/shared';
import { useAppTheme } from '../context/ThemeContext';
import { fonts } from '../theme';

interface CardProps {
  children: ReactNode;
  /** Sans bordure ni fond — pour grouper sans encadrer. */
  plain?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Card({ children, plain = false, style }: CardProps) {
  const { colors } = useAppTheme();
  return (
    <View
      style={[
        styles.card,
        plain
          ? { backgroundColor: 'transparent', borderWidth: 0, padding: 0 }
          : { backgroundColor: colors.surface, borderColor: colors.line },
        style,
      ]}
    >
      {children}
    </View>
  );
}

interface FieldProps {
  label?: string;
  /** Message d'erreur — remplace le texte d'aide quand il est présent. */
  error?: string | null;
  hint?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Field({ label, error, hint, children, style }: FieldProps) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.field, style]}>
      {label ? <Text style={[styles.label, { color: colors.inkSoft }]}>{label}</Text> : null}
      {children}
      {error ? (
        <Text style={[styles.message, { color: colors.danger }]}>{error}</Text>
      ) : hint ? (
        <Text style={[styles.message, { color: colors.muted }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

interface SectionProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Bloc titré — équivalent des `<section><h2>` du dashboard web. */
export function Section({ title, subtitle, children, style }: SectionProps) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.section, style]}>
      {title ? <Text style={[styles.title, { color: colors.ink }]}>{title}</Text> : null}
      {subtitle ? (
        <Text style={[styles.subtitle, { color: colors.inkSoft }]}>{subtitle}</Text>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii['3xl'],
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  field: { gap: spacing.sm },
  label: {
    fontFamily: fonts.bold,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  message: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16 },
  section: { gap: spacing.md },
  title: { fontFamily: fonts.display, fontSize: 20, letterSpacing: -0.4 },
  subtitle: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
});
