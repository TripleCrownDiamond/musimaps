import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Client Supabase de l'app native — données produit **et** authentification.
 *
 * Les options `auth` ne sont pas décoratives. Par défaut, supabase-js vise le
 * navigateur : il persiste la session dans `localStorage`, qui n'existe pas
 * sous React Native, et retombe alors sur un stockage en mémoire — la session
 * est perdue à chaque redémarrage, et tout code qui la relit
 * (`getSessionProfile`) ne trouve rien. L'utilisateur venait de se connecter
 * et se voyait redemander de le faire.
 *
 * `detectSessionInUrl` est web-only (il lit `window.location`) : sans objet
 * en natif, où le retour d'email passe par le deep link `musimaps://`.
 */
export const supabase =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          storage: AsyncStorage,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
      })
    : null;

export const hasSupabase = Boolean(supabase);
