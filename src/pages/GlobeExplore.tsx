import { useCallback, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ChevronLeft, Globe2, MapPin, Search, X } from 'lucide-react'
import GlobeMap, { type GlobeMapHandle } from '../components/GlobeMap'
import ArtistSheet from '../components/ArtistSheet'
import MapboxTokenNotice from '../components/MapboxTokenNotice'
import RotateToggle from '../components/RotateToggle'
import { artists, cities, searchArtists, type Artist } from '../data/artists'
import { hasMapboxToken } from '../lib/mapbox'
import { useThemeValue } from '../lib/theme'

/** Distance approximative en km entre deux points (formule de haversine). */
function distanceKm([lng1, lat1]: [number, number], [lng2, lat2]: [number, number]) {
  const toRad = (d: number) => (d * Math.PI) / 180
  const R = 6371
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

export default function GlobeExplore() {
  const mapRef = useRef<GlobeMapHandle | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Artist | null>(null)
  const [spinning, setSpinning] = useState(true)
  const theme = useThemeValue()

  const handleReady = useCallback((handle: GlobeMapHandle) => {
    mapRef.current = handle
  }, [])

  const results = useMemo(() => searchArtists(query), [query])
  const cityResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return cities.filter((c) => `${c.city} ${c.country}`.toLowerCase().includes(q))
  }, [query])

  // Artistes a moins de 500 km, pour l'onglet Nearby
  const nearby = useMemo(() => {
    if (!selected) return []
    return artists
      .filter((a) => a.id !== selected.id)
      .map((a) => ({ artist: a, d: distanceKm(selected.coordinates, a.coordinates) }))
      .filter(({ d }) => d < 500)
      .sort((a, b) => a.d - b.d)
      .map(({ artist }) => artist)
  }, [selected])

  const goToArtist = useCallback((artist: Artist) => {
    setSelected(artist)
    setSearchOpen(false)
    setQuery('')
    mapRef.current?.flyTo(artist.coordinates, 9)
  }, [])

  const goToCity = useCallback((coordinates: [number, number]) => {
    setSearchOpen(false)
    setQuery('')
    setSelected(null)
    mapRef.current?.flyTo(coordinates, 7)
  }, [])

  return (
    <div className="fixed inset-0 overflow-hidden bg-secondary-bg">
      {hasMapboxToken ? (
        <GlobeMap
          className="absolute inset-0 cursor-grab active:cursor-grabbing"
          onReady={handleReady}
          onSelectArtist={goToArtist}
          autoRotate={spinning}
          onAutoRotateChange={setSpinning}
          theme={theme}
        />
      ) : (
        <MapboxTokenNotice />
      )}

      {/* Bouton retour vers l'accueil (la page globe n'a pas de navbar) */}
      <Link
        to="/"
        aria-label="Retour à l'accueil"
        className="absolute left-4 top-6 z-30 flex items-center gap-2 rounded-full bg-white/85 px-4 py-2.5 text-sm font-medium shadow-lg backdrop-blur-xl transition-colors hover:bg-white sm:left-6"
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="hidden sm:inline">Accueil</span>
      </Link>

      {/* Barre de recherche */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 px-4 pt-24 sm:px-6">
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="pointer-events-auto mx-auto flex w-full max-w-2xl items-center gap-3 rounded-full bg-white/85 px-5 py-4 text-left shadow-lg backdrop-blur-xl transition-colors hover:bg-white"
        >
          <Search className="h-5 w-5 shrink-0 text-secondary-text" />
          <span className="flex-1 text-secondary-text">Chercher une ville, ou un artiste…</span>
        </button>
      </div>

      {/* Controles : retour vue globe + rotation auto */}
      {!selected && (
        <div className="pointer-events-none absolute bottom-6 left-0 right-0 z-20 flex flex-wrap justify-center gap-3 px-4">
          <button
            type="button"
            onClick={() => {
              setSelected(null)
              mapRef.current?.resetView()
            }}
            className="pointer-events-auto flex items-center gap-2 rounded-full bg-white/85 px-5 py-3 text-sm font-medium shadow-lg backdrop-blur-xl transition-colors hover:bg-white"
          >
            <Globe2 className="h-4 w-4 text-brand-deep" /> Vue Globe
          </button>
          {hasMapboxToken && (
            <RotateToggle
              active={spinning}
              onToggle={() => setSpinning((s) => !s)}
              className="pointer-events-auto"
            />
          )}
        </div>
      )}

      {/* Panneau de recherche */}
      {searchOpen && (
        <div className="absolute inset-0 z-40 flex flex-col justify-end bg-black/20 backdrop-blur-sm">
          <button
            type="button"
            aria-label="Fermer la recherche"
            className="flex-1"
            onClick={() => setSearchOpen(false)}
          />
          <div className="sheet-in rounded-t-[2rem] bg-surface p-5 sm:p-6">
            <div className="mx-auto w-full max-w-2xl">
              <div className="relative mb-5 flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => setSearchOpen(false)}
                  aria-label="Retour"
                  className="absolute left-0 flex h-10 w-10 items-center justify-center rounded-full bg-surface shadow-md"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <h2 className="display-font text-lg font-bold">Chercher une ville, ou un artiste…</h2>
              </div>

              <div className="relative mb-4 border-t border-hairline pt-5">
                <Search className="absolute left-5 top-1/2 h-5 w-5 translate-y-1 text-secondary-text" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Cotonou, Lagos, Aria Lyra…"
                  className="w-full rounded-full border border-hairline-strong py-4 pl-14 pr-12 outline-none focus:ring-2 focus:ring-brand-deep"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    aria-label="Effacer"
                    className="absolute right-5 top-1/2 translate-y-1 text-secondary-text hover:text-primary-text"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>

              <div className="max-h-[45vh] overflow-y-auto">
                {!query && (
                  <p className="py-8 text-center text-sm text-secondary-text">
                    Tape le nom d'une ville ou d'un artiste — la carte tournera jusqu'à lui.
                  </p>
                )}

                {query && cityResults.length === 0 && results.length === 0 && (
                  <p className="py-8 text-center text-sm text-secondary-text">
                    Aucun résultat pour « {query} ».
                  </p>
                )}

                {cityResults.length > 0 && (
                  <>
                    <h3 className="px-2 pb-2 pt-3 text-xs uppercase tracking-widest text-secondary-text">
                      Lieux
                    </h3>
                    <ul>
                      {cityResults.map((c) => (
                        <li key={c.city}>
                          <button
                            type="button"
                            onClick={() => goToCity(c.coordinates)}
                            className="flex w-full items-center gap-4 rounded-2xl p-3 text-left transition-colors hover:bg-secondary-bg"
                          >
                            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-soft text-brand-deep">
                              <MapPin className="h-5 w-5" />
                            </span>
                            <span className="flex-1">
                              <span className="block font-medium">
                                {c.flag} {c.city}
                              </span>
                              <span className="block text-sm text-secondary-text">
                                {c.country} · {c.count} artiste{c.count > 1 ? 's' : ''}
                              </span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {results.length > 0 && (
                  <>
                    <h3 className="px-2 pb-2 pt-3 text-xs uppercase tracking-widest text-secondary-text">
                      Artistes
                    </h3>
                    <ul>
                      {results.map((a) => (
                        <li key={a.id}>
                          <button
                            type="button"
                            onClick={() => goToArtist(a)}
                            className="flex w-full items-center gap-4 rounded-2xl p-3 text-left transition-colors hover:bg-secondary-bg"
                          >
                            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-deep text-sm font-bold text-white">
                              {a.name
                                .split(' ')
                                .map((w) => w[0])
                                .join('')
                                .slice(0, 2)
                                .toUpperCase()}
                            </span>
                            <span className="flex-1">
                              <span className="block font-medium">{a.name}</span>
                              <span className="block text-sm text-secondary-text">
                                {a.genre} · {a.city}, {a.country}
                              </span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bouton retour */}
      {selected && (
        <button
          type="button"
          onClick={() => {
            setSelected(null)
            mapRef.current?.flyTo([2.2, 6.4], 3)
          }}
          className="absolute left-4 top-4 z-30 flex items-center gap-2 rounded-full bg-white/85 px-4 py-2 text-sm font-medium shadow-lg backdrop-blur-xl transition-colors hover:bg-white"
        >
          <ChevronLeft className="h-4 w-4" /> Retour
        </button>
      )}

      {/* Fiche artiste */}
      {selected && (
        <ArtistSheet
          artist={selected}
          nearby={nearby}
          onClose={() => setSelected(null)}
          onSelectArtist={goToArtist}
        />
      )}
    </div>
  )
}
