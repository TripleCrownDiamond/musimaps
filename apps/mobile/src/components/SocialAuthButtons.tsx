import Ionicons from '@expo/vector-icons/Ionicons';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import {
  completeOAuthSignIn,
  OAUTH_PROVIDERS,
  radii,
  signInWithAppleIdToken,
  spacing,
  startOAuthSignIn,
} from '@musimaps/shared';
import { useAppTheme } from '../context/ThemeContext';
import { useI18n } from '../i18n';
import { fonts } from '../theme';
import { Button } from '../ui';

/** Retour du navigateur in-app vers l'app (autorisé dans Supabase : `musimaps://**`). */
const OAUTH_REDIRECT = 'musimaps://login';
/** Hauteur des boutons, alignée sur `Button size="lg"`. */
const BUTTON_HEIGHT = 50;

/**
 * « Continuer avec Apple / Google » au-dessus du formulaire e-mail — même
 * parcours que `SocialAuthButtons` côté web ; logique dans
 * `@musimaps/shared/lib/auth`. Apple passe par la feuille native d'iOS ;
 * Google par un navigateur in-app qui revient sur `musimaps://login`.
 *
 * `onSignedIn` est appelé une fois la session ouverte (le profil arrive par
 * l'écouteur de session d'`AuthContext`).
 */
export function SocialAuthButtons({
  onSignedIn,
  onError,
}: {
  onSignedIn: () => void;
  onError: (message: string) => void;
}) {
  const { colors, theme } = useAppTheme();
  const { t } = useI18n();
  const [busy, setBusy] = useState<'google' | 'apple' | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const providers = Platform.OS === 'ios' ? OAUTH_PROVIDERS.ios : OAUTH_PROVIDERS.android;

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    void AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => setAppleAvailable(false));
  }, []);

  const google = async () => {
    setBusy('google');
    try {
      const { url, error } = await startOAuthSignIn('google', { redirectTo: OAUTH_REDIRECT, skipBrowserRedirect: true });
      if (error || !url) return onError(t('auth.oauthError'));
      const result = await WebBrowser.openAuthSessionAsync(url, OAUTH_REDIRECT);
      if (result.type !== 'success') return; // fermé par l'utilisateur
      const { error: sessionError } = await completeOAuthSignIn(result.url);
      if (sessionError) return onError(t('auth.oauthError'));
      onSignedIn();
    } finally {
      setBusy(null);
    }
  };

  const apple = async () => {
    setBusy('apple');
    try {
      // Apple reçoit le SHA-256 du nonce ; Supabase vérifie avec la valeur brute.
      const rawNonce = Crypto.randomUUID();
      const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });
      if (!credential.identityToken) return onError(t('auth.oauthError'));
      const fullName = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(' ');
      const { error } = await signInWithAppleIdToken(credential.identityToken, rawNonce, fullName);
      if (error) return onError(t('auth.oauthError'));
      onSignedIn();
    } catch (error) {
      // Feuille Apple fermée par l'utilisateur : pas une erreur à afficher.
      if ((error as { code?: string }).code !== 'ERR_REQUEST_CANCELED') onError(t('auth.oauthError'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.wrap}>
      {providers.map((provider) =>
        provider === 'apple' ? (
          appleAvailable ? (
            <AppleAuthentication.AppleAuthenticationButton
              key={provider}
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={
                theme === 'dark'
                  ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                  : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
              }
              cornerRadius={BUTTON_HEIGHT / 2}
              style={styles.apple}
              onPress={() => {
                if (!busy) void apple();
              }}
            />
          ) : null
        ) : (
          <Button
            key={provider}
            block
            size="lg"
            variant="outline"
            loading={busy === 'google'}
            disabled={busy !== null}
            label={t('auth.continueGoogle')}
            onPress={() => void google()}
            icon={<Ionicons name="logo-google" size={18} color={colors.ink} />}
          />
        ),
      )}
      <View style={styles.divider}>
        <View style={[styles.rule, { backgroundColor: colors.line }]} />
        <Text style={[styles.dividerText, { color: colors.muted }]}>{t('auth.orEmail')}</Text>
        <View style={[styles.rule, { backgroundColor: colors.line }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  apple: { height: BUTTON_HEIGHT, width: '100%', borderRadius: radii.full },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
  dividerText: { fontFamily: fonts.body, fontSize: 12 },
});
