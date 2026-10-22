import type { NavigationProp } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import { useEffect, useRef } from 'react';
import { GUEST_NUDGE_DELAY_MS, GUEST_NUDGE_DURATION_MS } from '@musimaps/shared';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useI18n } from '../i18n';
import type { RootStackParamList } from '../navigation/types';

/**
 * Rappel doux, une seule fois par session, pour transformer une exploration
 * anonyme en expérience personnalisée. Le toast reste actionnable sans
 * interrompre la carte.
 */
export function GuestExperienceNudge() {
  const { user, loading } = useAuth();
  const { showToast } = useApp();
  const { t } = useI18n();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const shownRef = useRef(false);

  useEffect(() => {
    if (loading || user || shownRef.current) return;
    const timer = setTimeout(async () => {
      if (shownRef.current) return;
      // Le profil peut tarder (réseau) alors que la session existe : on ne
      // propose jamais de créer un compte à quelqu'un de déjà connecté.
      const { data } = (await supabase?.auth.getSession()) ?? { data: { session: null } };
      if (data.session || shownRef.current) return;
      shownRef.current = true;
      showToast(t('guest.nudge'), 'person-add-outline', 'success', {
        durationMs: GUEST_NUDGE_DURATION_MS,
        action: {
          label: t('guest.createAccount'),
          onPress: () => navigation.navigate('Signup'),
        },
      });
    }, GUEST_NUDGE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [loading, navigation, showToast, t, user]);

  return null;
}
