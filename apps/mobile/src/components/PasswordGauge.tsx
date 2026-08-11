import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { passwordStrength } from '@musimaps/shared';
import { useAppTheme } from '../context/ThemeContext';
import { useI18n } from '../i18n';
import { fonts, type AppColors } from '../theme';

/**
 * Jauge de force d'un mot de passe (3 segments + libellé localisé).
 * Réutilisée par l'inscription et l'édition de profil.
 */
export function PasswordGauge({ password }: { password: string }) {
  const { colors, theme } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useI18n();

  const strength = useMemo(() => passwordStrength(password), [password]);
  if (!password) return null;

  // Mêmes couleurs que la jauge web : rouge-500 pour faible, ambre-500 pour
  // moyen, lime pour fort. Le libellé « Fort » est bleu brand en clair,
  // lime en sombre (même logique web text-brand-deep dark:text-brand).
  const fill =
    strength.score === 0
      ? '#EF4444'
      : strength.score === 1
        ? '#EF4444'
        : strength.score === 2
          ? '#F59E0B'
          : colors.brand;

  const labelColor =
    strength.score === 0 || strength.score === 1
      ? '#EF4444'
      : strength.score === 2
        ? '#D97706'
        : theme === 'dark'
          ? colors.brand
          : colors.brandDeep;

  const label =
    strength.level === 'short'
      ? t('auth.pwShort')
      : strength.level === 'weak'
        ? t('auth.pwWeak')
        : strength.level === 'medium'
          ? t('auth.pwMedium')
          : strength.level === 'strong'
            ? t('auth.pwStrong')
            : '';

  return (
    <View style={styles.wrap}>
      <View style={styles.segments}>
        {[1, 2, 3].map((i) => (
          <View
            key={i}
            style={[styles.segment, strength.score >= i && { backgroundColor: fill }]}
          />
        ))}
      </View>
      <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
    </View>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    wrap: { marginBottom: 14 },
    segments: { flexDirection: 'row', gap: 6 },
    segment: {
      flex: 1,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.line,
    },
    label: { fontFamily: fonts.medium, fontSize: 12, marginTop: 4 },
  });
