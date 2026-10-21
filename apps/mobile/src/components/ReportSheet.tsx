import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  blockArtist,
  REPORT_DETAILS_MAX,
  REPORT_REASONS,
  reportArtist,
  type Artist,
  type ReportReason,
} from '@musimaps/shared';
import { useApp } from '../context/AppContext';
import { useAppTheme } from '../context/ThemeContext';
import { useI18n } from '../i18n';
import { fonts, type AppColors } from '../theme';

/**
 * Signaler une fiche d'artiste ou bloquer l'artiste — même parcours que
 * `ReportDialog` côté web, logique dans `@musimaps/shared/lib/moderation`.
 * Mêmes mesures que `BookingModal` : la feuille appartient à la même famille.
 */
export function ReportSheet({
  artist,
  onClose,
  onBlocked,
}: {
  artist: Artist;
  onClose: () => void;
  onBlocked?: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const { t } = useI18n();
  const { showToast } = useApp();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (!reason) return;
    setBusy(true);
    setError(null);
    const result = await reportArtist(artist.id, reason, details);
    setBusy(false);
    if (!result.ok) return setError(t('report.error'));
    showToast(t('report.sent'), 'flag');
    onClose();
  };

  const block = async () => {
    setBusy(true);
    setError(null);
    const result = await blockArtist(artist.id);
    setBusy(false);
    if (!result.ok) return setError(t('report.blockError'));
    showToast(t('report.blocked', { name: artist.name }), 'ban');
    onClose();
    onBlocked?.();
  };

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose} visible>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.scrim}>
        <Pressable style={styles.dismiss} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            <View style={styles.header}>
              <View style={styles.headerIcon}>
                <Ionicons name="flag" size={20} color={colors.ink} />
              </View>
              <View style={styles.headerCopy}>
                <Text style={styles.title}>{t('report.title')}</Text>
                <Text style={styles.subtitle}>{t('report.intro')}</Text>
              </View>
              <Pressable accessibilityLabel={t('report.cancel')} style={styles.close} onPress={onClose}>
                <Ionicons name="close" size={18} color={colors.ink} />
              </Pressable>
            </View>

            {REPORT_REASONS.map((item) => (
              <Pressable
                key={item}
                accessibilityRole="radio"
                accessibilityState={{ checked: reason === item }}
                style={[styles.option, reason === item && styles.optionActive]}
                onPress={() => setReason(item)}
              >
                <Text style={styles.optionText}>{t(`report.reason.${item}`)}</Text>
                <Ionicons
                  name={reason === item ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={reason === item ? colors.brandDeep : colors.muted}
                />
              </Pressable>
            ))}

            <TextInput
              value={details}
              onChangeText={setDetails}
              placeholder={t('report.details')}
              placeholderTextColor={colors.muted}
              maxLength={REPORT_DETAILS_MAX}
              multiline
              style={styles.details}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              accessibilityRole="button"
              disabled={!reason || busy}
              style={[styles.nextBtn, (!reason || busy) && styles.disabled]}
              onPress={() => void send()}
            >
              <Text style={styles.nextText}>{t('report.submit')}</Text>
            </Pressable>

            <View style={styles.blockBlock}>
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                style={[styles.backBtn, busy && styles.disabled]}
                onPress={() => void block()}
              >
                <Ionicons name="ban" size={16} color={colors.danger} />
                <Text style={styles.blockText}>{t('report.block')}</Text>
              </Pressable>
              <Text style={styles.optionHint}>{t('report.blockHint')}</Text>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(3,10,20,0.55)' },
    dismiss: { flex: 1 },
    sheet: { backgroundColor: colors.background, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingTop: 10, maxHeight: '88%' },
    handle: { alignSelf: 'center', width: 42, height: 5, borderRadius: 3, backgroundColor: colors.line, marginBottom: 12 },
    content: { paddingHorizontal: 20, paddingBottom: 28 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
    headerIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
    headerCopy: { flex: 1 },
    title: { color: colors.ink, fontFamily: fonts.displayBlack, fontSize: 20, letterSpacing: -0.6 },
    subtitle: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
    close: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
    option: {
      minHeight: 52,
      borderRadius: 18,
      borderWidth: 1.5,
      borderColor: colors.line,
      backgroundColor: colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      marginBottom: 10,
    },
    optionActive: { borderColor: colors.brandDeep, backgroundColor: colors.brandSoft },
    optionText: { flex: 1, color: colors.ink, fontFamily: fonts.bold, fontSize: 14 },
    optionHint: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 11, marginTop: 8, lineHeight: 15, textAlign: 'center' },
    details: {
      minHeight: 52 * 2,
      borderRadius: 18,
      borderWidth: 1.5,
      borderColor: colors.line,
      backgroundColor: colors.surface,
      paddingHorizontal: 16,
      paddingVertical: 12,
      marginBottom: 12,
      color: colors.ink,
      fontFamily: fonts.body,
      fontSize: 14,
      textAlignVertical: 'top',
    },
    error: { color: colors.danger, fontFamily: fonts.body, fontSize: 13, marginBottom: 12 },
    nextBtn: { minHeight: 52, borderRadius: 26, backgroundColor: colors.brandDeep, alignItems: 'center', justifyContent: 'center' },
    nextText: { color: colors.white, fontFamily: fonts.bold, fontSize: 15 },
    disabled: { opacity: 0.5 },
    blockBlock: { marginTop: 16, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
    backBtn: { minHeight: 52, borderRadius: 26, borderWidth: 1.5, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 16 },
    blockText: { color: colors.danger, fontFamily: fonts.bold, fontSize: 14 },
  });
