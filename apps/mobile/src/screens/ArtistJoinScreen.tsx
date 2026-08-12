import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ArtistJoin'>;

const initialForm = {
  artistName: '',
  email: '',
  city: '',
  district: '',
  genre: '',
  bio: '',
  link: '',
  spotify: '',
  youtube: '',
  instagram: '',
};

export function ArtistJoinScreen({ navigation, route }: Props) {
  const { t } = useI18n();
  const { applyAsArtist } = useApp();
  const { user, loading: authLoading } = useAuth();
  // Pré-remplissage depuis Musibrainz (artiste découvert sans localisation) :
  // le nom, le genre et la bio arrivent pré-remplis, l'utilisateur complète la
  // ville (obligatoire) — même chemin que le web, l'admin validera ensuite.
  const prefill = route.params ?? {};
  const [form, setForm] = useState(() => ({
    ...initialForm,
    artistName: prefill.artistName ?? '',
    genre: prefill.genre ?? '',
    bio: prefill.bio ?? '',
  }));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (key: keyof typeof initialForm, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    if (!form.artistName.trim() || !form.city.trim() || !form.email.includes('@')) {
      return setError('Nom d’artiste, ville et email valide sont obligatoires.');
    }
    setLoading(true);
    setError(null);
    const message = await applyAsArtist({
      ...form,
      userId: user?.id,
      bio: form.bio.trim(),
      spotify: form.spotify.trim(),
      youtube: form.youtube.trim(),
      instagram: form.instagram.trim(),
    });
    setLoading(false);
    if (message) setError(message);
    else {
      navigation.replace('Confirmation', {
        email: form.email.trim(),
        profile: 'artiste',
        artistName: form.artistName.trim(),
      });
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.top}>
          <Pressable style={styles.back} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={28} color={colors.ink} />
          </Pressable>
          <View style={styles.badge}>
            <Ionicons name="mic" size={16} color={colors.brandDeep} />
            <Text style={styles.badgeText}>APPEL AUX ARTISTES</Text>
          </View>
        </View>

        <Text style={styles.title}>Pose ton son sur la carte.</Text>
        <Text style={styles.subtitle}>
          Les premiers profils validés seront les premiers visibles au lancement.
        </Text>

        <View style={styles.form}>
          <Field label="Nom d’artiste *" value={form.artistName} placeholder="Votre nom de scène" onChangeText={(value) => update('artistName', value)} />
          <Field label="Email *" value={form.email} placeholder="vous@email.com" keyboardType="email-address" onChangeText={(value) => update('email', value)} />
          <Field label="Ville *" value={form.city} placeholder="Cotonou, Bénin" onChangeText={(value) => update('city', value)} />
          <Field label="Quartier / district" value={form.district} placeholder="Ex. Yopougon, Bastille…" onChangeText={(value) => update('district', value)} />
          <Field label="Genre musical" value={form.genre} placeholder="Afro-Soul" onChangeText={(value) => update('genre', value)} />
          <Field
            label="Bio"
            value={form.bio}
            placeholder="Ton univers, ton parcours, ce qui rend ta musique unique…"
            multiline
            onChangeText={(value) => update('bio', value)}
          />
          <Field label="Spotify" value={form.spotify} placeholder="https://open.spotify.com/…" autoCapitalize="none" onChangeText={(value) => update('spotify', value)} />
          <Field label="YouTube" value={form.youtube} placeholder="https://youtube.com/…" autoCapitalize="none" onChangeText={(value) => update('youtube', value)} />
          <Field label="Instagram" value={form.instagram} placeholder="https://instagram.com/…" autoCapitalize="none" onChangeText={(value) => update('instagram', value)} />
          <Field label="Autre lien" value={form.link} placeholder="Site, SoundCloud…" autoCapitalize="none" onChangeText={(value) => update('link', value)} />

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable disabled={loading || authLoading} style={styles.submit} onPress={submit}>
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Text style={styles.submitText}>Demander mon référencement</Text>
                <Ionicons name="paper-plane" size={19} color={colors.white} />
              </>
            )}
          </Pressable>
          <Text style={styles.privacy}>{t('join.privacy')}</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  ...props
}: {
  label: string;
  value: string;
  placeholder: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'sentences' | 'words';
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        underlineColorAndroid="transparent"
        style={[styles.input, props.multiline && styles.inputMultiline]}
        multiline={props.multiline}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 21, paddingTop: 54, paddingBottom: 55 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.brandSoft, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18 },
  badgeText: { color: colors.brandDeep, fontFamily: fonts.bold, fontSize: 10, letterSpacing: 1 },
  title: { color: colors.ink, fontFamily: fonts.displayBlack, fontSize: 40, lineHeight: 45, letterSpacing: -2, marginTop: 52 },
  subtitle: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 16, lineHeight: 23, marginTop: 10 },
  form: { gap: 15, marginTop: 30 },
  field: { gap: 7 },
  label: { color: colors.ink, fontFamily: fonts.bold, fontSize: 13, marginLeft: 4 },
  input: { height: 59, borderRadius: 20, backgroundColor: colors.white, color: colors.ink, fontFamily: fonts.body, fontSize: 16, paddingHorizontal: 17, borderWidth: 0, outlineWidth: 0 },
  inputMultiline: { height: 110, paddingTop: 15, textAlignVertical: 'top' },
  error: { color: colors.danger, fontFamily: fonts.medium, fontSize: 13, lineHeight: 19, backgroundColor: '#FFE8EB', borderRadius: 16, padding: 12 },
  submit: { minHeight: 62, borderRadius: 31, backgroundColor: colors.brandDeep, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 6, paddingHorizontal: 20 },
  submitText: { color: colors.white, fontFamily: fonts.bold, fontSize: 16 },
  privacy: { color: colors.inkSoft, fontFamily: fonts.body, fontSize: 11, lineHeight: 16, textAlign: 'center', paddingHorizontal: 22 },
  });
