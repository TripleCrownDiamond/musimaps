import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import {
  ActivityIndicator,
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
import type { Artist } from '@musimaps/shared';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../context/ThemeContext';
import { useI18n, type MessageKey } from '../i18n';
import { requestBooking, type BookingPref } from '../lib/booking';
import { notifyArtistAction } from '../lib/stats';
import { fonts, type AppColors } from '../theme';

interface BookingModalProps {
  artist: Artist;
  onClose: () => void;
}

const STEP_KEYS = ['type', 'date', 'location', 'budget', 'audience', 'message', 'contact', 'prefs'] as const;
type StepKey = (typeof STEP_KEYS)[number];

const STEP_TITLES: Record<StepKey, MessageKey> = {
  type: 'booking.type.title',
  date: 'booking.date.title',
  location: 'booking.location.title',
  budget: 'booking.budget.title',
  audience: 'booking.audience.title',
  message: 'booking.message.title',
  contact: 'booking.contact.title',
  prefs: 'booking.prefs.title',
};

const EVENT_TYPES = ['private', 'festival', 'concert', 'wedding', 'corporate', 'other'] as const;
const BUDGETS = ['under500', '500_2000', '2000_5000', '5000_10000', '10000'] as const;
const AUDIENCES = ['private', '100', '500', '1000', '5000'] as const;
const PREFS: { value: BookingPref; icon: string }[] = [
  { value: 'email', icon: '✉️' },
  { value: 'whatsapp', icon: '💬' },
  { value: 'phone', icon: '📞' },
  { value: 'any', icon: '🙌' },
];

interface FormState {
  eventType: string;
  eventDate: string;
  flexible: boolean;
  city: string;
  country: string;
  address: string;
  budgetRange: string;
  budgetAmount: string;
  audienceSize: string;
  message: string;
  contactName: string;
  company: string;
  phone: string;
  website: string;
  instagram: string;
  linkedin: string;
  contactPrefs: BookingPref[];
}

const INITIAL_FORM: FormState = {
  eventType: '',
  eventDate: '',
  flexible: false,
  city: '',
  country: '',
  address: '',
  budgetRange: '',
  budgetAmount: '',
  audienceSize: '',
  message: '',
  contactName: '',
  company: '',
  phone: '',
  website: '',
  instagram: '',
  linkedin: '',
  contactPrefs: [],
};

export function BookingModal({ artist, onClose }: BookingModalProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [gated, setGated] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const togglePref = (pref: BookingPref) =>
    setForm((current) => {
      if (pref === 'any') return { ...current, contactPrefs: current.contactPrefs.includes('any') ? [] : ['any'] };
      const withoutAny = current.contactPrefs.filter((p) => p !== 'any');
      const next = withoutAny.includes(pref) ? withoutAny.filter((p) => p !== pref) : [...withoutAny, pref];
      return { ...current, contactPrefs: next };
    });

  const validate = (key: StepKey): string | null => {
    switch (key) {
      case 'type':
        return form.eventType ? null : t('booking.required');
      case 'date':
        return form.flexible || form.eventDate.trim() ? null : t('booking.required');
      case 'location':
        if (!form.city.trim()) return t('booking.city');
        if (!form.country.trim()) return t('booking.country');
        return null;
      case 'budget':
        return form.budgetRange || form.budgetAmount.trim() ? null : t('booking.required');
      case 'audience':
        return form.audienceSize ? null : t('booking.required');
      case 'message':
        return form.message.trim() ? null : t('booking.required');
      case 'contact':
        return form.contactName.trim() ? null : t('booking.contact.name');
      case 'prefs':
        return form.contactPrefs.length ? null : t('booking.required');
    }
  };

  const next = () => {
    const err = validate(STEP_KEYS[step]);
    if (err) return setError(err);
    setError(null);
    setStep((s) => Math.min(s + 1, STEP_KEYS.length - 1));
  };

  const submit = async () => {
    const err = validate('prefs');
    if (err) return setError(err);
    setError(null);
    setBusy(true);
    const result = await requestBooking({
      artistId: artist.id,
      artistName: artist.name,
      eventType: t(`booking.type.${form.eventType}` as MessageKey),
      eventDate: form.eventDate.trim(),
      flexible: form.flexible,
      city: form.city.trim(),
      country: form.country.trim(),
      address: form.address.trim(),
      budgetRange: form.budgetAmount
        ? `~${form.budgetAmount} €`
        : t(`booking.budget.${form.budgetRange}` as MessageKey),
      budgetAmount: form.budgetAmount.trim(),
      audienceSize: t(`booking.audience.${form.audienceSize}` as MessageKey),
      message: form.message.trim(),
      contactName: form.contactName.trim(),
      company: form.company.trim(),
      phone: form.phone.trim(),
      website: form.website.trim(),
      instagram: form.instagram.trim(),
      linkedin: form.linkedin.trim(),
      contactPrefs: form.contactPrefs,
    });
    setBusy(false);
    if (result.ok) {
      setDone(true);
      // Notifie l'artiste revendiqué : nouvelle demande de réservation.
      const typeLabel = t(`booking.type.${form.eventType}` as MessageKey);
      const msg =
        lang === 'fr'
          ? `${form.contactName || "Quelqu'un"} souhaite te réserver pour un ${typeLabel}.`
          : `${form.contactName || 'Someone'} wants to book you for a ${typeLabel}.`;
      void notifyArtistAction(artist.id, 'booking', msg);
    } else if (result.error && /not_subscriber|subscriber/i.test(result.error)) setGated(true);
    else setError(result.error ?? t('booking.failed'));
  };

  const inputStyle = [styles.input, { borderColor: colors.line, backgroundColor: colors.surface, color: colors.ink }];
  const inputProps = { underlineColorAndroid: 'transparent' as const };

  const renderStep = () => {
    const key = STEP_KEYS[step];
    switch (key) {
      case 'type':
        return (
          <View style={styles.stepBody}>
            <Text style={styles.stepHint}>{t('booking.type.hint')}</Text>
            {EVENT_TYPES.map((value) => {
              const active = form.eventType === value;
              return (
                <Pressable key={value} style={[styles.option, active && styles.optionActive]} onPress={() => set('eventType', value)}>
                  <Text style={styles.optionText}>{t(`booking.type.${value}` as MessageKey)}</Text>
                  {active && <Ionicons name="checkmark-circle" size={22} color={colors.brandDeep} />}
                </Pressable>
              );
            })}
          </View>
        );
      case 'date':
        return (
          <View style={styles.stepBody}>
            <Text style={styles.label}>📅 {t('booking.date.label')}</Text>
            <TextInput
              value={form.eventDate}
              onChangeText={(v) => set('eventDate', v)}
              editable={!form.flexible}
              placeholder={t('booking.datePh')}
              placeholderTextColor={colors.muted}
              style={[...inputStyle, form.flexible && styles.disabled]} {...inputProps}
            />
            <Pressable style={[styles.option, form.flexible && styles.optionActive]} onPress={() => set('flexible', !form.flexible)}>
              <View style={styles.optionCopy}>
                <Text style={styles.optionText}>📆 {t('booking.flexible')}</Text>
                <Text style={styles.optionHint}>{t('booking.flexibleHint')}</Text>
              </View>
              {form.flexible && <Ionicons name="checkmark-circle" size={22} color={colors.brandDeep} />}
            </Pressable>
          </View>
        );
      case 'location':
        return (
          <View style={styles.stepBody}>
            <Text style={styles.label}>{t('booking.city')}</Text>
            <TextInput value={form.city} onChangeText={(v) => set('city', v)} placeholder="Paris" placeholderTextColor={colors.muted} style={inputStyle} {...inputProps} />
            <Text style={styles.label}>{t('booking.country')}</Text>
            <TextInput value={form.country} onChangeText={(v) => set('country', v)} placeholder="France" placeholderTextColor={colors.muted} style={inputStyle} {...inputProps} />
            <Text style={styles.label}>{t('booking.address')}</Text>
            <TextInput value={form.address} onChangeText={(v) => set('address', v)} placeholder="12 rue de la Musique" placeholderTextColor={colors.muted} style={inputStyle} {...inputProps} />
          </View>
        );
      case 'budget':
        return (
          <View style={styles.stepBody}>
            {BUDGETS.map((value) => {
              const active = form.budgetRange === value && !form.budgetAmount;
              return (
                <Pressable key={value} style={[styles.option, active && styles.optionActive]} onPress={() => { set('budgetRange', value); set('budgetAmount', ''); }}>
                  <Text style={styles.optionText}>{t(`booking.budget.${value}` as MessageKey)}</Text>
                  {active && <Ionicons name="checkmark-circle" size={22} color={colors.brandDeep} />}
                </Pressable>
              );
            })}
            <Text style={styles.label}>💵 {t('booking.budget.custom')}</Text>
            <TextInput
              value={form.budgetAmount}
              onChangeText={(v) => { set('budgetAmount', v); if (v) set('budgetRange', ''); }}
              placeholder={t('booking.budget.customPh')}
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
              style={inputStyle} {...inputProps}
            />
          </View>
        );
      case 'audience':
        return (
          <View style={styles.stepBody}>
            <View style={styles.grid}>
              {AUDIENCES.map((value) => {
                const active = form.audienceSize === value;
                return (
                  <Pressable key={value} style={[styles.option, styles.gridOption, active && styles.optionActive]} onPress={() => set('audienceSize', value)}>
                    <Text style={styles.optionText}>{t(`booking.audience.${value}` as MessageKey)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      case 'message':
        return (
          <View style={styles.stepBody}>
            <Text style={styles.label}>{t('booking.message.title')}</Text>
            <TextInput
              value={form.message}
              onChangeText={(v) => set('message', v)}
              placeholder={t('booking.messagePh')}
              placeholderTextColor={colors.muted}
              multiline
              numberOfLines={5}
              style={[...inputStyle, styles.textarea]} {...inputProps}
            />
          </View>
        );
      case 'contact':
        return (
          <View style={styles.stepBody}>
            <View style={styles.emailBox}>
              <Text style={styles.emailLabel}>{t('booking.contact.email')}</Text>
              <Text style={styles.emailValue}>{user?.email ?? '—'}</Text>
            </View>
            <Text style={styles.label}>{t('booking.contact.name')}</Text>
            <TextInput value={form.contactName} onChangeText={(v) => set('contactName', v)} placeholder="Jean Martin" placeholderTextColor={colors.muted} style={inputStyle} {...inputProps} />
            <Text style={styles.label}>{t('booking.contact.company')}</Text>
            <TextInput value={form.company} onChangeText={(v) => set('company', v)} placeholder="Festival XYZ" placeholderTextColor={colors.muted} style={inputStyle} {...inputProps} />
            <Text style={styles.label}>{t('booking.contact.phone')}</Text>
            <TextInput value={form.phone} onChangeText={(v) => set('phone', v)} placeholder="+33 6 12 34 56 78" placeholderTextColor={colors.muted} keyboardType="phone-pad" style={inputStyle} {...inputProps} />
            <View style={styles.triple}>
              <View style={styles.tripleItem}>
                <Text style={styles.label}>{t('booking.contact.website')}</Text>
                <TextInput value={form.website} onChangeText={(v) => set('website', v)} placeholder="https://…" placeholderTextColor={colors.muted} style={inputStyle} {...inputProps} />
              </View>
              <View style={styles.tripleItem}>
                <Text style={styles.label}>{t('booking.contact.instagram')}</Text>
                <TextInput value={form.instagram} onChangeText={(v) => set('instagram', v)} placeholder="@…" placeholderTextColor={colors.muted} style={inputStyle} {...inputProps} />
              </View>
              <View style={styles.tripleItem}>
                <Text style={styles.label}>{t('booking.contact.linkedin')}</Text>
                <TextInput value={form.linkedin} onChangeText={(v) => set('linkedin', v)} placeholder="in/…" placeholderTextColor={colors.muted} style={inputStyle} {...inputProps} />
              </View>
            </View>
          </View>
        );
      case 'prefs':
        return (
          <View style={styles.stepBody}>
            <Text style={styles.stepHint}>{t('booking.prefs.title')}</Text>
            {PREFS.map(({ value, icon }) => {
              const active = form.contactPrefs.includes(value);
              return (
                <Pressable key={value} style={[styles.option, active && styles.optionActive]} onPress={() => togglePref(value)}>
                  <Text style={styles.optionText}>{icon} {t(`booking.prefs.${value}` as MessageKey)}</Text>
                  {active && <Ionicons name="checkmark-circle" size={22} color={colors.brandDeep} />}
                </Pressable>
              );
            })}
          </View>
        );
    }
  };

  const totalSteps = STEP_KEYS.length;
  const isLast = step === totalSteps - 1;

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose} visible>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.scrim}>
        <Pressable style={styles.dismiss} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            <View style={styles.header}>
              <View style={styles.headerIcon}>
                <Ionicons name="calendar" size={22} color={colors.ink} />
              </View>
              <View style={styles.headerCopy}>
                <Text style={styles.title}>{t('booking.title', { name: artist.name })}</Text>
                <Text style={styles.subtitle}>{t('booking.subtitle')}</Text>
              </View>
              <Pressable accessibilityLabel={t('booking.closeAria')} style={styles.close} onPress={onClose}>
                <Ionicons name="close" size={22} color={colors.ink} />
              </Pressable>
            </View>

            {done ? (
              <View style={styles.centerBlock}>
                <Ionicons name="checkmark-circle" size={56} color={colors.success} />
                <Text style={styles.stateTitle}>{t('booking.successShort')}</Text>
              </View>
            ) : gated ? (
              <View style={styles.centerBlock}>
                <Text style={styles.stateEmoji}>👑</Text>
                <Text style={styles.stateTitle}>{t('booking.gated')}</Text>
                <Text style={styles.stateText}>{t('booking.gatedText')}</Text>
              </View>
            ) : !user ? (
              <View style={styles.centerBlock}>
                <Ionicons name="lock-closed" size={40} color={colors.brandDeep} />
                <Text style={styles.stateTitle}>{t('booking.loginTitle')}</Text>
                <Text style={styles.stateText}>{t('booking.loginText')}</Text>
              </View>
            ) : (
              <>
                <View style={styles.progressRow}>
                  {STEP_KEYS.map((_, index) => (
                    <View key={index} style={[styles.progressDot, index <= step && styles.progressDotActive]} />
                  ))}
                </View>
                <View style={styles.stepHeader}>
                  <Text style={styles.stepTitle}>{t(STEP_TITLES[STEP_KEYS[step]])}</Text>
                  <Text style={styles.stepCount}>{t('booking.stepOf', { current: step + 1, total: totalSteps })}</Text>
                </View>

                {renderStep()}

                {error && <Text style={styles.error}>{error}</Text>}

                <View style={styles.footer}>
                  <Pressable
                    style={[styles.backBtn, step === 0 && styles.disabled]}
                    disabled={step === 0}
                    onPress={() => { setError(null); setStep((s) => Math.max(s - 1, 0)); }}
                  >
                    <Ionicons name="arrow-back" size={18} color={colors.ink} />
                    <Text style={styles.backText}>{t('booking.back')}</Text>
                  </Pressable>
                  {isLast ? (
                    <Pressable style={[styles.nextBtn, busy && styles.disabled]} disabled={busy} onPress={() => void submit()}>
                      {busy ? <ActivityIndicator color={colors.white} /> : <Ionicons name="send" size={18} color={colors.white} />}
                      <Text style={styles.nextText}>{t('booking.submit')}</Text>
                    </Pressable>
                  ) : (
                    <Pressable style={styles.nextBtn} onPress={next}>
                      <Text style={styles.nextText}>{t('booking.next')}</Text>
                      <Ionicons name="arrow-forward" size={18} color={colors.white} />
                    </Pressable>
                  )}
                </View>
              </>
            )}
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
    progressRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
    progressDot: { flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.line },
    progressDotActive: { backgroundColor: colors.brandDeep },
    stepHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    stepTitle: { color: colors.ink, fontFamily: fonts.displayBlack, fontSize: 19, letterSpacing: -0.6 },
    stepCount: { color: colors.muted, fontFamily: fonts.bold, fontSize: 12 },
    stepBody: { marginBottom: 4 },
    stepHint: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 13, marginBottom: 12 },
    label: { color: colors.ink, fontFamily: fonts.bold, fontSize: 13, marginBottom: 6, marginTop: 4 },
    input: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, fontFamily: fonts.body, fontSize: 15, marginBottom: 12, outlineWidth: 0 },
    disabled: { opacity: 0.5 },
    textarea: { minHeight: 100, textAlignVertical: 'top' },
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
    optionCopy: { flex: 1 },
    optionText: { color: colors.ink, fontFamily: fonts.bold, fontSize: 14 },
    optionHint: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 11, marginTop: 3, lineHeight: 15 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    gridOption: { width: '48%' },
    emailBox: { borderRadius: 16, backgroundColor: colors.brandSoft, padding: 14, marginBottom: 12 },
    emailLabel: { color: colors.brandDeep, fontFamily: fonts.bold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 },
    emailValue: { color: colors.black, fontFamily: fonts.bold, fontSize: 15, marginTop: 3 },
    triple: { flexDirection: 'row', gap: 8 },
    tripleItem: { flex: 1 },
    error: { color: colors.danger, fontFamily: fonts.body, fontSize: 13, marginBottom: 12, marginTop: 2 },
    footer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
    backBtn: { minHeight: 52, borderRadius: 26, borderWidth: 1.5, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16 },
    backText: { color: colors.ink, fontFamily: fonts.bold, fontSize: 14 },
    nextBtn: { flex: 1, minHeight: 52, borderRadius: 26, backgroundColor: colors.brandDeep, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
    nextText: { color: colors.white, fontFamily: fonts.bold, fontSize: 15 },
    centerBlock: { alignItems: 'center', paddingVertical: 26, gap: 10 },
    stateEmoji: { fontSize: 40 },
    stateTitle: { color: colors.ink, fontFamily: fonts.displayBlack, fontSize: 20, letterSpacing: -0.5, textAlign: 'center' },
    stateText: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  });
