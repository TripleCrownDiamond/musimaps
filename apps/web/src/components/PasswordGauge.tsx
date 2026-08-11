import { passwordStrength } from '@musimaps/shared'
import { useLanguage } from '../i18n/LanguageContext'

/**
 * Jauge de force d'un mot de passe — mêmes couleurs et disposition que le
 * composant mobile (PasswordGauge.tsx) : rouge-500 (faible), ambre-500 (moyen),
 * lime (fort) ; libellé « Fort » bleu brand en clair, lime en sombre.
 * La logique passwordStrength() est partagée (packages/shared).
 */
export function PasswordGauge({ password }: { password: string }) {
  const { t } = useLanguage()
  const strength = passwordStrength(password)
  if (!password) return null

  const segColor =
    strength.score === 0
      ? 'bg-red-500'
      : strength.score === 1
        ? 'bg-red-500'
        : strength.score === 2
          ? 'bg-amber-500'
          : 'bg-brand'

  const segLabel =
    strength.level === 'short' || strength.level === 'weak'
      ? 'text-red-500'
      : strength.level === 'medium'
        ? 'text-amber-600'
        : 'text-brand-deep dark:text-brand'

  const pwLabel =
    strength.level === 'short'
      ? t('auth.pwShort')
      : strength.level === 'weak'
        ? t('auth.pwWeak')
        : strength.level === 'medium'
          ? t('auth.pwMedium')
          : strength.level === 'strong'
            ? t('auth.pwStrong')
            : ''

  return (
    <div className="mt-1.5">
      <div className="flex gap-1.5">
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              strength.score >= i ? segColor : 'bg-hairline-strong'
            }`}
          />
        ))}
      </div>
      <span className={`mt-1 block text-xs font-medium ${segLabel}`}>{pwLabel}</span>
    </div>
  )
}
