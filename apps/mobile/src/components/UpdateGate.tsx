import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { Linking, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { hexToRgba, radii, spacing, updateRequirement, type UpdateRequirement } from '@musimaps/shared';
import { supabase } from '../lib/supabase';
import { useAppTheme } from '../context/ThemeContext';
import { useI18n } from '../i18n';
import { fonts, shadow } from '../theme';
import { Button } from '../ui';

/**
 * Fenêtre de mise à jour de l'application.
 *
 * Les versions sont pilotées depuis l'admin (section « Réglages ») : publier
 * suffit, aucun nouveau build n'est nécessaire pour prévenir les utilisateurs.
 *
 *   - `latestAppVersion` > version installée → on PROPOSE, la fenêtre se ferme.
 *   - `minAppVersion`    > version installée → on IMPOSE, la fenêtre bloque.
 *
 * Le blocage est une arme lourde : il rend l'app inutilisable tant que le
 * store n'a pas livré la nouvelle version. `updateRequirement` refuse donc de
 * bloquer sur la moindre donnée douteuse, et cette fenêtre ne s'affiche jamais
 * si le CMS est injoignable — une panne réseau ne doit pas condamner l'app.
 */
export function UpdateGate() {
  const { colors } = useAppTheme();
  const { t } = useI18n();
  const [requirement, setRequirement] = useState<UpdateRequirement>('none');
  const [message, setMessage] = useState('');
  const [storeUrl, setStoreUrl] = useState('');
  /** L'utilisateur a écarté une mise à jour facultative pour cette session. */
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let cancelled = false;

    const check = async () => {
      try {
        const { data } = await client
          .from('site_content_public')
          .select('content')
          .eq('key', 'settings')
          .maybeSingle();
        if (cancelled) return;
        const settings = (data?.content ?? {}) as Record<string, unknown>;
        const current = Constants.expoConfig?.version ?? '';
        setRequirement(
          updateRequirement({
            current,
            latest: typeof settings.latestAppVersion === 'string' ? settings.latestAppVersion : '',
            minimum: typeof settings.minAppVersion === 'string' ? settings.minAppVersion : '',
          }),
        );
        if (typeof settings.updateMessage === 'string') setMessage(settings.updateMessage);
        const key = Platform.OS === 'ios' ? 'appStoreUrl' : 'playStoreUrl';
        const url = settings[key];
        if (typeof url === 'string') setStoreUrl(url);
      } catch {
        /* CMS injoignable : on n'affiche rien plutôt que de bloquer à tort */
      }
    };

    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  const required = requirement === 'required';
  const visible = requirement !== 'none' && !(dismissed && !required);
  if (!visible) return null;

  const openStore = () => {
    if (!storeUrl) return;
    void Linking.openURL(storeUrl).catch(() => {});
  };

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      // Une mise à jour imposée ne se referme pas au bouton retour Android.
      onRequestClose={() => {
        if (!required) setDismissed(true);
      }}
    >
      <View style={[styles.backdrop, { backgroundColor: hexToRgba(colors.black, 0.55) }]}>
        <View style={[styles.card, { backgroundColor: colors.surface }, shadow]}>
          <View style={[styles.icon, { backgroundColor: colors.brandSoft }]}>
            <Ionicons name="rocket-outline" size={28} color={colors.brandDeep} />
          </View>
          <Text style={[styles.title, { color: colors.ink }]}>
            {required ? t('update.requiredTitle') : t('update.optionalTitle')}
          </Text>
          <Text style={[styles.text, { color: colors.inkSoft }]}>
            {message || (required ? t('update.requiredText') : t('update.optionalText'))}
          </Text>
          <Button
            block
            size="lg"
            variant="brand"
            label={t('update.cta')}
            onPress={openStore}
            style={styles.cta}
          />
          {!required && (
            <Pressable accessibilityRole="button" onPress={() => setDismissed(true)}>
              <Text style={[styles.later, { color: colors.inkSoft }]}>{t('update.later')}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    borderRadius: radii.xl,
    padding: spacing.lg,
  },
  icon: {
    height: 60,
    width: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.full,
    marginBottom: spacing.md,
  },
  title: { fontFamily: fonts.display, fontSize: 21, textAlign: 'center' },
  text: {
    marginTop: spacing.sm,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  cta: { marginTop: spacing.lg },
  later: { marginTop: spacing.md, fontFamily: fonts.medium, fontSize: 14 },
});
