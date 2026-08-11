import AsyncStorage from '@react-native-async-storage/async-storage'
import { getLocales } from 'expo-localization'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { MESSAGES, translate, type Lang, type MessageKey } from '@musimaps/shared'

/**
 * i18n mobile — le PROVIDER seulement.
 *
 * Les messages vivent dans `packages/shared/src/i18n/`, partages avec le
 * web. Pour ajouter ou modifier un texte : editer fr.ts ET en.ts la-bas.
 * Voir docs/REGLES-EVOLUTION.md.
 */
export type { Lang, MessageKey }
export { MESSAGES }

/** Preference de langue : systeme, ou un choix explicite FR/EN. */
export type LangPref = 'system' | Lang

const LANG_PREF_KEY = 'musimaps.mobile.lang-pref'

/**
 * Détecte la langue de l'appareil : expo-localization (langue du système)
 * puis repli sur Intl/Hermes. Toute autre langue retombe sur le français.
 */
export function detectDeviceLang(): Lang {
  try {
    const code = getLocales()[0]?.languageCode?.toLowerCase() ?? ''
    if (code.startsWith('fr')) return 'fr'
    if (code.startsWith('en')) return 'en'
  } catch {
    /* expo-localization indisponible */
  }
  try {
    const locale = (Intl.DateTimeFormat().resolvedOptions().locale ?? '').toLowerCase()
    if (locale.startsWith('fr')) return 'fr'
    if (locale.startsWith('en')) return 'en'
  } catch {
    /* Intl indisponible */
  }
  return 'fr'
}

/** Mois abrégés pour la date des récompenses, par langue. */
export const MONTHS_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
export const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Labels/descriptions EN du catalogue de badges par défaut (repli hors CMS). */
export const DEFAULT_BADGE_EN: Record<string, { label: string; description: string }> = {
  'first-city': { label: 'First step', description: 'Visit your first city' },
  'cities-3': { label: 'Curious', description: 'Visit 3 cities' },
  'cities-8': { label: 'Globe-trotter', description: 'Visit 8 cities' },
  'cities-15': { label: 'Explorer', description: 'Visit 15 cities' },
  'first-save': { label: 'Crush', description: 'Save an artist' },
  'saves-5': { label: 'Melomaniac', description: 'Save 5 artists' },
  'saves-12': { label: 'Collector', description: 'Save 12 artists' },
  profile: { label: 'Ambassador', description: 'Create your profile' },
}

/** Titres de niveau en EN (le catalogue FR vit dans gamification.ts). */
export const LEVEL_TITLE_EN: Record<number, string> = {
  1: 'Explorer',
  2: 'Traveler',
  3: 'Globe-trotter',
  4: 'Navigator',
  5: 'Connoisseur',
  6: 'Legend',
}

interface I18nValue {
  lang: Lang
  /** Préférence active : 'system' (langue de l'appareil) ou FR/EN explicite. */
  langPref: LangPref
  /** Change la préférence (persistée sur l'appareil, comme le thème). */
  setLangPref: (pref: LangPref) => void
  /** Traduit une clé (params optionnels : {name}, {count}…). */
  t: (key: MessageKey, params?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nValue | null>(null)

/**
 * Fournit la langue de l'appareil (préférence persistée : Système / FR / EN)
 * et la fonction t(). Par défaut 'system' → détection de la langue de
 * l'appareil ; un choix explicite reste appliqué jusqu'à retour à « Système ».
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [langPref, setLangPrefState] = useState<LangPref>('system')

  useEffect(() => {
    AsyncStorage.getItem(LANG_PREF_KEY)
      .then((saved) => {
        if (saved === 'system' || saved === 'fr' || saved === 'en') {
          setLangPrefState(saved);
        }
      })
      .catch(() => {});
  }, []);

  const lang: Lang = langPref === 'system' ? detectDeviceLang() : langPref

  const setLangPref = useCallback((pref: LangPref) => {
    setLangPrefState(pref);
    AsyncStorage.setItem(LANG_PREF_KEY, pref).catch(() => {});
  }, []);

  const t = useCallback(
    (key: MessageKey, params?: Record<string, string | number>) =>
      translate(lang, key, params),
    [lang],
  )

  const value = useMemo(
    () => ({ lang, langPref, setLangPref, t }),
    [lang, langPref, setLangPref, t],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext)
  if (!value) throw new Error('useI18n must be used within LanguageProvider')
  return value
}
