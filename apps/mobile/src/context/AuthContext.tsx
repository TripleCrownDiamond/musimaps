import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import {
  fetchProfile,
  getSessionProfile,
  resetPasswordForEmail as apiResetPasswordForEmail,
  signIn as apiSignIn,
  signOut as apiSignOut,
  signUp as apiSignUp,
  type AccountRole,
  type AuthError,
  type UserProfile,
} from '@musimaps/shared';
import { supabase } from '../lib/supabase';

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  signUp: (params: {
    email: string;
    password: string;
    role: AccountRole;
    displayName: string;
    city: string;
    country: string;
  }) => Promise<{ error: AuthError | null; needsConfirmation: boolean }>;
  signIn: (email: string, password: string) => Promise<AuthError | null>;
  signOut: () => Promise<void>;
  /** Envoie l'email de réinitialisation de mot de passe. */
  resetPasswordForEmail: (email: string) => Promise<AuthError | null>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  signUp: async () => ({ error: null, needsConfirmation: false }),
  signIn: async () => null,
  signOut: async () => {},
  resetPasswordForEmail: async () => null,
});

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void getSessionProfile().then((profile) => {
      if (cancelled) return;
      setUser(profile);
      setLoading(false);
    });
    const authListener = supabase?.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        void fetchProfile(session.user.id, session.user.email ?? null).then((profile) => {
          if (cancelled) return;
          setUser(profile);
          setLoading(false);
        });
      } else {
        setUser(null);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
      authListener?.data.subscription.unsubscribe();
    };
  }, []);

  const signUp = useCallback<AuthContextValue['signUp']>(async (params) => {
    const { user: created, error, needsConfirmation } = await apiSignUp(params);
    if (error) return { error, needsConfirmation: false };
    if (created) setUser(created);
    return { error: null, needsConfirmation };
  }, []);

  const signIn = useCallback<AuthContextValue['signIn']>(async (email, password) => {
    const { user: connected, error } = await apiSignIn(email, password);
    if (error) return error;
    if (connected) setUser(connected);
    return null;
  }, []);

  const signOut = useCallback(async () => {
    await apiSignOut();
    setUser(null);
  }, []);

  const resetPasswordForEmail = useCallback<AuthContextValue['resetPasswordForEmail']>(
    async (email) => (await apiResetPasswordForEmail(email)).error,
    [],
  );

  const value = useMemo(
    () => ({ user, loading, signUp, signIn, signOut, resetPasswordForEmail }),
    [user, loading, signUp, signIn, signOut, resetPasswordForEmail],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
