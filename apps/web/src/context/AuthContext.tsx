import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import {
  fetchProfile,
  getSessionProfile,
  resetPasswordForEmail as apiResetPasswordForEmail,
  signIn as apiSignIn,
  signOut as apiSignOut,
  signUp as apiSignUp,
  updatePassword as apiUpdatePassword,
  updateProfile as apiUpdateProfile,
  type AccountRole,
  type AuthError,
  type UserProfile,
} from '@musimaps/shared'

interface AuthContextValue {
  user: UserProfile | null
  /** true tant qu'on n'a pas encore restauré la session. */
  loading: boolean
  signUp: (params: {
    email: string
    password: string
    role: AccountRole
    displayName: string
    city: string
    country: string
  }) => Promise<{ error: AuthError | null; needsConfirmation: boolean }>
  signIn: (email: string, password: string) => Promise<AuthError | null>
  signOut: () => Promise<void>
  /** Envoie l'email de réinitialisation de mot de passe. */
  resetPasswordForEmail: (email: string) => Promise<{ error: AuthError | null }>
  /** Enregistre le nouveau mot de passe (lien de récupération actif). */
  updatePassword: (newPassword: string) => Promise<{ error: AuthError | null }>
  /** Recharge le profil depuis la base (après une bascule business, etc.). */
  refresh: () => Promise<void>
  /** Met à jour nom / ville / genres du compte connecté, puis recharge. */
  updateProfile: (params: {
    displayName?: string
    city?: string
    district?: string
    country?: string
    favoriteGenres?: string[]
    avatarUrl?: string | null
  }) => Promise<{ error: AuthError | null }>
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  signUp: async () => ({ error: null, needsConfirmation: false }),
  signIn: async () => null,
  signOut: async () => {},
  resetPasswordForEmail: async () => ({ error: null }),
  updatePassword: async () => ({ error: null }),
  refresh: async () => {},
  updateProfile: async () => ({ error: null }),
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  // Restaure la session + écoute les changements d'auth.
  useEffect(() => {
    let cancelled = false
    void getSessionProfile().then((profile) => {
      if (cancelled) return
      setUser(profile)
      setLoading(false)
    })
    const authListener = supabase?.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        void fetchProfile(session.user.id, session.user.email ?? null).then((profile) => {
          if (cancelled) return
          setUser(profile)
          setLoading(false)
        })
      } else {
        setUser(null)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
      authListener?.data.subscription.unsubscribe()
    }
  }, [])

  const signUp = useCallback<AuthContextValue['signUp']>(async (params) => {
    const { user: created, error, needsConfirmation } = await apiSignUp(params)
    if (error) return { error, needsConfirmation: false }
    if (created) setUser(created)
    return { error: null, needsConfirmation }
  }, [])

  const signIn = useCallback<AuthContextValue['signIn']>(async (email, password) => {
    const { user: connected, error } = await apiSignIn(email, password)
    if (error) return error
    if (connected) setUser(connected)
    return null
  }, [])

  const signOut = useCallback(async () => {
    await apiSignOut()
    setUser(null)
  }, [])

  const resetPasswordForEmail = useCallback<AuthContextValue['resetPasswordForEmail']>(
    async (email) => apiResetPasswordForEmail(email),
    [],
  )

  const updatePassword = useCallback<AuthContextValue['updatePassword']>(
    async (newPassword) => apiUpdatePassword(newPassword),
    [],
  )

  const refresh = useCallback(async () => {
    const profile = await getSessionProfile()
    if (profile) setUser(profile)
  }, [])

  const updateProfile = useCallback<AuthContextValue['updateProfile']>(async (params) => {
    const { error } = await apiUpdateProfile(params)
    if (!error) await refresh()
    return { error }
  }, [refresh])

  const value = useMemo(
    () => ({
      user,
      loading,
      signUp,
      signIn,
      signOut,
      resetPasswordForEmail,
      updatePassword,
      refresh,
      updateProfile,
    }),
    [user, loading, signUp, signIn, signOut, resetPasswordForEmail, updatePassword, refresh, updateProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
