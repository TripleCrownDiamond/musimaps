/**
 * En-tête d'écran secondaire — retour, titre centré, action optionnelle.
 *
 * Badges, Dashboard, Notifications, ProfileEdit, ArtistJoin et ArtistProfile
 * redéfinissaient chacun la MÊME pastille de retour de 46 px et le même titre
 * `displayBlack` de 20 px. Six copies d'une mise en page, pas d'un style
 * d'écran : quand l'une bougeait, les cinq autres restaient en arrière.
 *
 * `AuthLayout` porte déjà son propre retour — les écrans d'authentification
 * n'ont pas de titre de barre, leur titre est le hero.
 */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { radii, spacing } from '@musimaps/shared';
import { useAppTheme } from '../context/ThemeContext';
import { useI18n } from '../i18n';
import { fonts } from '../theme';

/** Diamètre de la pastille de retour — aligné sur `AuthLayout`. */
const BUTTON_SIZE = 46;

interface ScreenHeaderProps {
  title?: string;
  /** Retour arrière. Absent = pas de bouton retour. */
  onBack?: () => void;
  /**
   * Action à droite. Absente, un espaceur de même largeur prend sa place :
   * sans lui le titre centré se décale de la moitié du bouton de retour.
   */
  action?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function ScreenHeader({ title, onBack, action, style }: ScreenHeaderProps) {
  const { colors } = useAppTheme();
  const { t } = useI18n();

  return (
    <View style={[styles.row, style]}>
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          onPress={onBack}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: colors.surface },
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="chevron-back" size={27} color={colors.ink} />
        </Pressable>
      ) : (
        <View style={styles.spacer} />
      )}

      {title ? (
        <Text numberOfLines={1} style={[styles.title, { color: colors.ink }]}>
          {title}
        </Text>
      ) : (
        <View style={styles.flex} />
      )}

      {action ?? <View style={styles.spacer} />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.82 },
  spacer: { width: BUTTON_SIZE },
  flex: { flex: 1 },
  title: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.displayBlack,
    fontSize: 20,
    letterSpacing: -0.6,
  },
});
