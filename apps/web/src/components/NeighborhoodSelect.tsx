import { Loader2, MapPin, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { searchNeighborhoods, type NeighborhoodSuggestion } from '@musimaps/shared'
import { useLanguage } from '../i18n/LanguageContext'

/** Autocomplete Mapbox des quartiers, partagé par les formulaires artiste et profil. */
export function NeighborhoodSelect({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (value: string, suggestion?: NeighborhoodSuggestion) => void
  placeholder: string
}) {
  const { t } = useLanguage()
  const [query, setQuery] = useState(value)
  const [results, setResults] = useState<NeighborhoodSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) setQuery(value)
  }, [value, open])

  useEffect(() => {
    if (!open) return
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    const timer = window.setTimeout(() => {
      void searchNeighborhoods(q)
        .then((next) => {
          if (!cancelled) setResults(next)
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 280)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [open, query])

  return (
    <div className="relative">
      <div className="flex items-center rounded-2xl border border-hairline-strong bg-warm-white px-5 py-3.5 focus-within:ring-2 focus-within:ring-brand-deep">
        <MapPin className="mr-3 h-4 w-4 shrink-0 text-secondary-text" />
        <input
          value={query}
          onChange={(event) => {
            const next = event.target.value
            setQuery(next)
            setOpen(true)
            onChange(next)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          autoComplete="address-line1"
          className="w-full bg-transparent outline-none"
          aria-label={placeholder}
        />
        {loading ? <Loader2 className="ml-2 h-4 w-4 animate-spin text-brand-deep" /> : <Search className="ml-2 h-4 w-4 text-secondary-text" />}
      </div>
      {open && query.trim().length >= 2 && (
        <div className="absolute inset-x-0 z-30 mt-2 overflow-hidden rounded-2xl border border-hairline bg-surface shadow-xl">
          {loading && results.length === 0 ? (
            <div className="px-4 py-4 text-center text-sm text-secondary-text">{t('common.loading')}</div>
          ) : results.length === 0 ? (
            <div className="px-4 py-4 text-center text-sm text-secondary-text">{t('location.noNeighborhood')}</div>
          ) : (
            results.map((result, index) => (
              <button
                key={`${result.lng},${result.lat},${result.name},${index}`}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setQuery(result.name)
                  setOpen(false)
                  onChange(result.name, result)
                }}
                className="flex w-full items-center gap-3 border-b border-hairline px-4 py-3 text-left last:border-b-0 hover:bg-secondary-bg"
              >
                <MapPin className="h-4 w-4 shrink-0 text-brand-deep" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{result.name}</span>
                  <span className="block truncate text-xs text-secondary-text">{[result.city, result.country].filter(Boolean).join(', ')}</span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
