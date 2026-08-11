import { cn } from '@/lib/utils'

/** Bascule FR/EN pour l'édition d'une section du CMS. */
export function LangSwitch({
  lang,
  onChange,
}: {
  lang: 'fr' | 'en'
  onChange: (lang: 'fr' | 'en') => void
}) {
  return (
    <div
      role="group"
      aria-label="Langue éditée"
      className="flex items-center gap-1 rounded-full border border-hairline-strong p-1"
    >
      {(['fr', 'en'] as const).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => onChange(code)}
          aria-pressed={lang === code}
          className={cn(
            'rounded-full px-3 py-1 text-xs font-bold uppercase transition-colors',
            lang === code
              ? 'bg-brand text-black'
              : 'text-secondary-text hover:text-primary-text',
          )}
        >
          {code}
        </button>
      ))}
    </div>
  )
}
