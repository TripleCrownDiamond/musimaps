/**
 * Mise en page des écrans d'authentification — bouton retour, pastille
 * d'icône, titre, sous-titre, et lien de bascule en pied.
 *
 * Les quatre écrans (Login, Signup, ForgotPassword, ResetPassword)
 * redéfinissaient chacun les MÊMES neuf clés de style : `back`, `hero`,
 * `heroIcon`, `heroCopy`, `title`, `subtitle`, `switchLink`, `switchText`,
 * `switchLinkText`. Ce n'est pas du style d'écran, c'est une mise en page.
 *
 * Elle absorbe aussi le `KeyboardAvoidingView` + `ScrollView` que les quatre
 * répétaient à l'identique.
 */
import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { radii, spacing } from '@musimaps/shared';
import { useAppTheme } from '../context/ThemeContext';
import { useI18n } from '../i18n';
import { fonts } from '../theme';

interface AuthLayoutProps {
  /** Glyphe de la pastille lime en tête d'écran. */
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  /** Retour arrière. Absent = pas de bouton retour. */
  onBack?: () => void;
  children: ReactNode;
  /** Pied de page : « Pas encore de compte ? S'inscrire ». */
  footer?: { text?: string; linkLabel: string; onPress: () => void };
}

export function AuthLayout({
  icon,
  title,
  subtitle,
  onBack,
  children,
  footer,
}: AuthLayoutProps) {
  const { colors } = useAppTheme();
  const { t } = useI18n();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.root, { backgroundColor: colors.background }]}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            onPress={onBack}
            style={[styles.back, { backgroundColor: colors.surface }]}
          >
            <Ionicons name="chevron-back" size={27} color={colors.ink} />
          </Pressable>
        ) : null}

        <View style={styles.hero}>
          <View style={[styles.heroIcon, { backgroundColor: colors.brandSecondary }]}>
            <Ionicons name={icon} size={30} color={colors.black} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={[styles.title, { color: colors.ink }]}>{title}</Text>
            {subtitle ? (
              <Text style={[styles.subtitle, { color: colors.inkSoft }]}>{subtitle}</Text>
            ) : null}
          </View>
        </View>

        {children}

        {footer ? (
          <Pressable
            accessibilityRole="button"
            onPress={footer.onPress}
            style={styles.switchLink}
          >
            <Text style={[styles.switchText, { color: colors.inkSoft }]}>
              {footer.text ? `${footer.text} ` : ''}
              <Text style={[styles.switchLinkText, { color: colors.brandPrimary }]}>
                {footer.linkLabel}
              </Text>
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    paddingHorizontal: spacing['2xl'],
    paddingTop: spacing.lg,
    paddingBottom: spacing['4xl'],
    gap: spacing.lg,
  },
  back: {
    width: 46,
    height: 46,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: { alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.md },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCopy: { alignItems: 'center', marginTop: spacing.lg },
  title: {
    fontFamily: fonts.displayBlack,
    fontSize: 30,
    letterSpacing: -1,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    textAlign: 'center',
    marginTop: spacing.xs,
    lineHeight: 20,
  },
  switchLink: { alignItems: 'center', marginTop: spacing.lg },
  switchText: { fontFamily: fonts.body, fontSize: 13 },
  switchLinkText: { fontFamily: fonts.bold },
});
