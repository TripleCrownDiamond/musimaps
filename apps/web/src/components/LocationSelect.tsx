import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Globe2, Loader2, MapPin, Search } from 'lucide-react'
import type { CountryInfo, Continent } from '@musimaps/shared'
import {
  COUNTRIES,
  CONTINENT_NAMES,
  continentOf,
  countryByCode,
  countryName,
  flagFor,
} from '@musimaps/shared'
import { suggestCities, type CitySuggestion } from '@musimaps/shared'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/* ------------------------------------------------------------------ */
/* Combobox générique (recherche + liste filtrée)                      */
/* ------------------------------------------------------------------ */

interface ComboboxOption {
  value: string
  label: string
  sublabel?: string
  emoji?: string
}

function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
  emptyText,
  searchPlaceholder,
}: {
  options: ComboboxOption[]
  value: string
  onChange: (value: string) => void
  placeholder: string
  emptyText: string
  searchPlaceholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const filtered = useMemo(() => {
    const q = query
      .toLocaleLowerCase('fr')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
    if (!q) return options
    return options.filter(
      (o) =>
        o.label.toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q) ||
        (o.sublabel ?? '')
          .toLocaleLowerCase('fr')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .includes(q),
    )
  }, [options, query])

  const selected = options.find((o) => o.value === value)

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="border-input dark:bg-input/30 flex w-full items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <span className="flex min-w-0 items-center gap-2">
          {selected?.emoji && <span className="shrink-0 text-base">{selected.emoji}</span>}
          <span className={cn('truncate', !selected && 'text-muted-foreground')}>
            {selected ? selected.label : placeholder}
          </span>
        </span>
        <Search className="size-4 shrink-0 opacity-50" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover shadow-lg">
          <div className="border-b border-border p-1.5">
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder ?? placeholder}
              className="h-8"
            />
          </div>
          <ul className="max-h-56 overflow-y-auto p-1">
            {filtered.length === 0 && (
              <li className="px-2 py-3 text-center text-xs text-muted-foreground">{emptyText}</li>
            )}
            {filtered.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(o.value)
                    setOpen(false)
                    setQuery('')
                  }}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
                >
                  {o.emoji && <span className="shrink-0 text-base">{o.emoji}</span>}
                  <span className="min-w-0 flex-1 truncate">
                    {o.label}
                    {o.sublabel && (
                      <span className="text-muted-foreground ml-1 text-xs">{o.sublabel}</span>
                    )}
                  </span>
                  {o.value === value && <Check className="size-4 shrink-0" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Pays + continent                                                    */
/* ------------------------------------------------------------------ */

const countryOptions = (lang: 'fr' | 'en'): ComboboxOption[] =>
  COUNTRIES.map((c: CountryInfo) => ({
    value: c.code,
    label: lang === 'fr' ? c.fr : c.en,
    sublabel: CONTINENT_NAMES[c.continent][lang],
    emoji: flagFor(c.code),
  }))

const continentOptions = (lang: 'fr' | 'en'): ComboboxOption[] =>
  (Object.keys(CONTINENT_NAMES) as Continent[]).map((c) => ({
    value: c,
    label: CONTINENT_NAMES[c][lang],
  }))

/* ------------------------------------------------------------------ */
/* Ville (Mapbox)                                                      */
/* ------------------------------------------------------------------ */

function CityCombobox({
  value,
  countryCode,
  onChange,
  placeholder,
  emptyText,
}: {
  value: string
  countryCode?: string | null
  onChange: (city: CitySuggestion) => void
  placeholder: string
  emptyText: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CitySuggestion[]>([])
  const [searching, setSearching] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  /** Dernier pays utilisé pour la recherche (détecte les changements). */
  const lastCountryRef = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  useEffect(() => {
    abortRef.current?.abort()
    // Le pays a changé : on vide les résultats (ils venaient de l'ancien pays).
    if (query.trim() && countryCode !== lastCountryRef.current) {
      lastCountryRef.current = countryCode
      setResults([])
      setSearching(false)
    }
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      setSearching(false)
      return
    }
    const controller = new AbortController()
    abortRef.current = controller
    const timer = setTimeout(() => {
      setSearching(true)
      void suggestCities(q, countryCode, controller.signal)
        .then((res) => setResults(res))
        .finally(() => setSearching(false))
    }, 300)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, countryCode])

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder={value || placeholder}
          className="pl-8"
        />
        {searching && (
          <Loader2 className="text-muted-foreground absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin" />
        )}
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover shadow-lg">
          <ul className="max-h-56 overflow-y-auto p-1">
            {query.trim().length < 2 && (
              <li className="px-2 py-3 text-center text-xs text-muted-foreground">{emptyText}</li>
            )}
            {query.trim().length >= 2 && results.length === 0 && !searching && (
              <li className="px-2 py-3 text-center text-xs text-muted-foreground">Aucune ville trouvée</li>
            )}
            {results.map((r) => (
              <li key={`${r.lng},${r.lat},${r.city}`}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(r)
                    setQuery('')
                    setOpen(false)
                  }}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
                >
                  <MapPin className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{r.label}</span>
                  {value === r.city && <Check className="size-4 shrink-0" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* LocationSelect : continent + pays + ville                           */
/* ------------------------------------------------------------------ */

export interface LocationValue {
  city: string
  country: string
  flag: string
  lat: number
  lng: number
  /** Nom du continent en clair (ex. « Afrique ») — dérivé du pays. */
  continent: string
}

export function LocationSelect({
  value,
  onChange,
  lang = 'fr',
  showContinent = false,
}: {
  value: LocationValue
  onChange: (value: LocationValue) => void
  lang?: 'fr' | 'en'
  /** Affiche aussi le sélecteur de continent (sinon il est dérivé du pays). */
  showContinent?: boolean
}) {
  const code = countryByCode(value.country)?.code

  const handleCountry = (newCode: string) => {
    const continent = continentOf(newCode)
    onChange({
      ...value,
      country: newCode,
      flag: flagFor(newCode),
      continent: continent ? CONTINENT_NAMES[continent][lang] : '',
    })
  }

  const handleContinent = (c: string) => {
    onChange({ ...value, continent: c })
  }

  const handleCity = (city: CitySuggestion) => {
    const continent = continentOf(city.countryCode)
    onChange({
      city: city.city,
      country: city.countryCode ?? value.country,
      flag: city.countryCode ? flagFor(city.countryCode) : value.flag,
      lat: city.lat,
      lng: city.lng,
      continent: continent ? CONTINENT_NAMES[continent][lang] : value.continent,
    })
  }

  return (
    <div className="grid gap-3">
      {showContinent && (
        <div>
          <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Continent
          </Label>
          <SearchableSelect
            options={continentOptions(lang)}
            value={value.continent}
            onChange={handleContinent}
            placeholder="Sélectionner un continent…"
            emptyText="Aucun continent"
          />
        </div>
      )}
      <div>
        <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          {lang === 'fr' ? 'Pays' : 'Country'}
        </Label>
        <SearchableSelect
          options={countryOptions(lang)}
          value={code ?? ''}
          onChange={handleCountry}
          placeholder={lang === 'fr' ? 'Rechercher un pays…' : 'Search a country…'}
          emptyText={lang === 'fr' ? 'Aucun pays trouvé' : 'No country found'}
        />
      </div>
      <div>
        <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          {lang === 'fr' ? 'Ville' : 'City'}
        </Label>
        <CityCombobox
          value={value.city}
          countryCode={code}
          onChange={handleCity}
          placeholder={
            lang === 'fr' ? 'Rechercher une ville… (ex. Cotonou)' : 'Search a city… (e.g. Cotonou)'
          }
          emptyText={lang === 'fr' ? 'Tapez au moins 2 lettres' : 'Type at least 2 letters'}
        />
        <p className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
          <Globe2 className="size-3" />
          {value.city || '—'}
          {value.country ? `, ${countryName(value.country, lang)}` : ''}
          {value.lat && value.lng ? ` · ${value.lat.toFixed(2)}, ${value.lng.toFixed(2)}` : ''}
          {value.continent ? ` · ${value.continent}` : ''}
        </p>
      </div>
    </div>
  )
}
