import Ionicons from '@expo/vector-icons/Ionicons';
import { Headphones, MicVocal } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radii, spacing, type AccountRole } from '@musimaps/shared';
import { useAppTheme } from '../context/ThemeContext';
import { useI18n } from '../i18n';
import { fonts, type AppColors } from '../theme';

// Mêmes icônes que le web (lucide) : micro chanteur (avec fil) pour l'artiste, casque pour le mélomane.
const ROLE_ICONS: Record<AccountRole, typeof MicVocal | typeof Headphones> = {
  artist: MicVocal,
  melomane: Headphones,
};

/**
 * Choix artiste / mélomane — inscription par e-mail et complétion du profil
 * après une connexion Google ou Apple (même parcours que `RolePicker` web).
 */
export function RolePicker({
  value,
  onChange,
}: {
  value: AccountRole | null;
  onChange: (role: AccountRole) => void;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useI18n();
  const roles: { value: AccountRole; label: string; hint: string }[] = [
    { value: 'artist', label: t('auth.roleArtist'), hint: t('auth.roleArtistHint') },
    { value: 'melomane', label: t('auth.roleMelomane'), hint: t('auth.roleMelomaneHint') },
  ];

  return (
    <View style={styles.roles}>
      {roles.map(({ value: role, label, hint }) => {
        const active = value === role;
        const RoleIcon = ROLE_ICONS[role];
        return (
          <Pressable
            key={role}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            style={[styles.roleCard, active && styles.roleCardActive]}
            onPress={() => onChange(role)}
          >
            <View style={[styles.roleIcon, active && styles.roleIconActive]}>
              <RoleIcon size={22} color={active ? colors.black : colors.brandPrimary} />
            </View>
            <View style={styles.roleCopy}>
              <Text style={[styles.roleLabel, active && styles.roleLabelActive]}>{label}</Text>
              <Text style={styles.roleHint}>{hint}</Text>
            </View>
            {active && <Ionicons name="checkmark-circle" size={22} color={colors.brandPrimary} />}
          </Pressable>
        );
      })}
    </View>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    roles: { gap: spacing.md },
    roleCard: {
      minHeight: 74,
      borderRadius: radii['3xl'],
      borderWidth: 1.5,
      borderColor: colors.line,
      backgroundColor: colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
    },
    roleCardActive: { borderColor: colors.brandPrimary, backgroundColor: colors.brandSoft },
    roleIcon: {
      width: 46,
      height: 46,
      borderRadius: radii.full,
      backgroundColor: colors.brandSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    roleIconActive: { backgroundColor: colors.brandSecondary },
    roleCopy: { flex: 1 },
    roleLabel: { color: colors.ink, fontFamily: fonts.bold, fontSize: 15 },
    // Actif : en clair le fond est lime pâle (texte sombre), en sombre le
    // fond est bleu nuit (texte clair) — ink s'adapte aux deux.
    roleLabelActive: { color: colors.ink },
    roleHint: {
      color: colors.inkSoft,
      fontFamily: fonts.body,
      fontSize: 11,
      marginTop: spacing.xs,
      lineHeight: 16,
    },
  });
