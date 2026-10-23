import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import {
  fetchMyPublicSettings,
  HANDLE_MAX,
  normalizeHandle,
  radii,
  setPublicProfile,
  spacing,
  suggestHandle,
} from '@musimaps/shared';
import { useApp } from '../../context/AppContext';
import { useAppTheme } from '../../context/ThemeContext';
import { useI18n } from '../../i18n';
import { fonts, type AppColors } from '../../theme';
import { Button } from '../../ui';

/**
 * Profil public au choix : interrupteur et @identifiant — même réglage que
 * `PublicProfileSettings` côté web (la bio se modifie déjà dans le
 * formulaire du profil). Privé par défaut (00080).
 */
export function PublicProfileSettings({
  displayName,
  onViewProfile,
}: {
  displayName: string;
  onViewProfile: (handle: string) => void;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useI18n();
  const { showToast } = useApp();
  const [loaded, setLoaded] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [savedHandle, setSavedHandle] = useState<string | null>(null);
  const [handle, setHandle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchMyPublicSettings().then((settings) => {
      if (cancelled) return;
      setIsPublic(settings?.isPublic ?? false);
      setSavedHandle(settings?.handle ?? null);
      setHandle(settings?.handle ?? '');
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Identifiant proposé à partir du nom tant que la personne n'en a pas choisi.
  useEffect(() => {
    if (loaded && !handle && !savedHandle) setHandle(suggestHandle(displayName));
  }, [loaded, handle, savedHandle, displayName]);

  const save = async () => {
    setError(null);
    setBusy(true);
    const result = await setPublicProfile(isPublic, handle);
    setBusy(false);
    if (!result.ok) {
      setError(result.error === 'handle_taken' ? t('community.handleTaken') : t('community.handleInvalid'));
      return;
    }
    if (isPublic) setSavedHandle(normalizeHandle(handle));
    showToast(t('community.saved'), 'checkmark-circle');
  };

  if (!loaded) return null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.flex}>
          <View style={styles.titleRow}>
            <Ionicons name="globe-outline" size={17} color={colors.brandDeep} />
            <Text style={styles.title}>{t('community.publicProfile')}</Text>
          </View>
          <Text style={styles.hint}>{t('community.publicProfileHint')}</Text>
        </View>
        <Switch value={isPublic} onValueChange={setIsPublic} accessibilityLabel={t('community.publicProfile')} />
      </View>

      {isPublic && (
        <View>
          <Text style={styles.label}>{t('community.handle')}</Text>
          <View style={styles.handleField}>
            <Text style={styles.at}>@</Text>
            <TextInput
              value={handle}
              maxLength={HANDLE_MAX}
              onChangeText={(value) => setHandle(normalizeHandle(value))}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
          </View>
          <Text style={styles.hint}>{t('community.handleHint')}</Text>
        </View>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actions}>
        <Button loading={busy} label={t('collection.save')} onPress={() => void save()} />
        {savedHandle ? <Button variant="link" label={t('community.viewMyProfile')} onPress={() => onViewProfile(savedHandle)} /> : null}
      </View>
    </View>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    card: {
      gap: spacing.md,
      padding: spacing.lg,
      borderRadius: radii['3xl'],
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.surface,
      marginTop: spacing.xl,
    },
    header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
    flex: { flex: 1 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    title: { color: colors.ink, fontFamily: fonts.bold, fontSize: 16 },
    hint: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, marginTop: spacing.xs },
    label: { color: colors.ink, fontFamily: fonts.bold, fontSize: 13, marginBottom: spacing.xs },
    handleField: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: radii['2xl'],
      borderWidth: 1.5,
      borderColor: colors.line,
      backgroundColor: colors.background,
      paddingHorizontal: spacing.lg,
    },
    at: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 15 },
    input: { flex: 1, minHeight: 48, paddingLeft: spacing.xs, color: colors.ink, fontFamily: fonts.body, fontSize: 15 },
    error: { color: colors.danger, fontFamily: fonts.bold, fontSize: 13 },
    actions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  });
