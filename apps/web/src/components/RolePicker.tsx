import { Headphones, MicVocal } from 'lucide-react'
import type { AccountRole } from '@musimaps/shared'
import { useLanguage } from '../i18n/LanguageContext'

/**
 * Choix artiste / mélomane — inscription par e-mail et complétion du profil
 * après une connexion Google (même parcours que `RolePicker` mobile).
 */
export default function RolePicker({
  value,
  onChange,
}: {
  value: AccountRole | null
  onChange: (role: AccountRole) => void
}) {
  const { t } = useLanguage()
  const roles: { value: AccountRole; label: string; hint: string; icon: typeof MicVocal }[] = [
    // Micro chanteur avec fil (comme le mobile) pour l'artiste, casque pour le mélomane.
    { value: 'artist', label: t('auth.roleArtist'), hint: t('auth.roleArtistHint'), icon: MicVocal },
    { value: 'melomane', label: t('auth.roleMelomane'), hint: t('auth.roleMelomaneHint'), icon: Headphones },
  ]

  return (
    <div role="radiogroup" aria-label={t('auth.role')} className="grid gap-3">
      <span className="text-sm font-medium">{t('auth.role')}</span>
      {roles.map(({ value: role, label, hint, icon: Icon }) => (
        <button
          key={role}
          type="button"
          role="radio"
          aria-checked={value === role}
          onClick={() => onChange(role)}
          className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition-all ${
            value === role
              ? 'border-brand-deep bg-brand-soft ring-2 ring-brand-deep dark:border-brand dark:ring-brand'
              : 'border-hairline-strong hover:bg-secondary-bg'
          }`}
        >
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors ${
              value === role
                ? 'bg-brand text-black'
                : 'bg-brand-soft text-brand-deep dark:bg-brand-soft dark:text-brand'
            }`}
          >
            <Icon className="h-5 w-5" />
          </span>
          <span>
            <span className="block font-semibold">{label}</span>
            <span className="block text-xs text-secondary-text">{hint}</span>
          </span>
        </button>
      ))}
    </div>
  )
}
