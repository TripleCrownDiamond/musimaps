import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, Globe2, History, Loader2, MapPin, Mic2, Music2, Pencil, Plus, Search, Send, Shuffle, X } from 'lucide-react'
import GlobeMap, { type GlobeMapHandle } from '../components/GlobeMap'
import ArtistSheet from '../components/ArtistSheet'
import PlacePanel, { type PlacePanelData } from '../components/PlacePanel'
import MapboxTokenNotice from '../components/MapboxTokenNotice'
import RotateToggle from '../components/RotateToggle'
import AdminArtistEditor from '../components/AdminArtistEditor'
import { currentUserEmail, isAdminUser } from '../lib/admin'
import type { Artist } from '@musimaps/shared'
import { CAMERA, countryByName, flagFor, geoCountryOf, isScopeArmed, shouldReleaseScope } from '@musimaps/shared'
import { GLOBE_VIEW, hasMapboxToken } from '../lib/mapbox'
import { useThemeValue } from '../lib/theme'
import { useCms } from '../context/CmsContext'
import { resolveBrandLogo } from '@musimaps/shared'
import logoBlack from '../assets/brand/logo-black.png'
import logoWhite from '../assets/brand/logo-white.png'
import iconBlue from '../assets/brand/icon.png'
import iconWhite from '../assets/brand/icon-white.png'
import {
  addMapArtist,
  addOrUpdateMapArtist,
  fetchMapArtists,
  locateArtist,
  searchArtistOnline,
  searchNeighborhoods,
  toArtist,
  type DiscoveredArtist,
  type MapArtistView,
  type NeighborhoodSuggestion,
} from '@musimaps/shared'
import { fetchAllArtistPopularity, recordPinView } from '@musimaps/shared'
import { toast } from 'sonner'
import { AnimatedAvatar } from '../components/AnimatedAvatar'
import { useLanguage, useLocalizedPath } from '../i18n/LanguageContext'
import { addSearchHistory, clearSearchHistory, getSearchHistory } from '@musimaps/shared'
import { useAuth } from '../context/AuthContext'
import { isValidEmail, saveSignup } from '../lib/waitlist'

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

/** Normalise une chaîne : minuscules + accents retirés (recherche tolérante).
 *  Tolère null/undefined (certains artistes n'ont pas de ville ni de pays). */
function norm(value: string | null | undefined) {
  return (value ?? '')
    .toLocaleLowerCase('fr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

export default function GlobeExplore() {
  const { t } = useLanguage()
  const localize = useLocalizedPath()
  const { content } = useCms()
  const theme = useThemeValue()
  const mapRef = useRef<GlobeMapHandle | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Artist | null>(null)
  const [spinning, setSpinning] = useState(true)

  /*
   * Édition administrateur.
   *
   * `isAdmin` ne fait QUE l'interface : c'est la politique RLS
   * `map_artists_update_admin` (migration 00016) qui autorise réellement
   * l'écriture. Truquer ce booléen dans le navigateur ne donne donc aucun
   * droit — au pire un panneau qui échoue à l'enregistrement.
   *
   * Le mode ne s'active pas tout seul : un admin explore la carte comme tout
   * le monde la plupart du temps, et des pins déplaçables par mégarde sur des
   * données de production seraient un piège.
   */
  const [isAdmin, setIsAdmin] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editArtist, setEditArtist] = useState<Artist | null>(null)
  const [movedTo, setMovedTo] = useState<[number, number] | null>(null)

  useEffect(() => {
    let alive = true
    void currentUserEmail()
      .then((email) => (email ? isAdminUser(email) : false))
      .then((admin) => {
        if (alive) setIsAdmin(admin)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])
  // Logo navbar : CMS (priorité) sinon logo officiel embarqué — comme la navbar.
  const navbarLogo =
    resolveBrandLogo(
      content.brand.navbarLogoLight,
      content.brand.navbarLogoDark,
      theme,
    ) ?? (theme === 'dark' ? logoWhite : logoBlack)
  const navbarLogoHeight = content.brand.navbarLogoHeight || 40
  // Niveau de zoom de la carte : dès qu'on s'éloigne de la vue monde (zoom
  // de clustering par ville), la barre de recherche se replie en icône dans
  // le coin haut droit — la carte reprend toute la place.
  const [mapZoom, setMapZoom] = useState(GLOBE_VIEW.zoom)
  const searchCollapsed = selected !== null || mapZoom >= 3.2

  // Historique de recherche (stockage partagé, asynchrone) + filtres du
  // panneau Découverte. Il se charge après le premier rendu : la liste part
  // vide puis se remplit, comme sur mobile.
  const [history, setHistory] = useState<string[]>([])
  const [discoverCity, setDiscoverCity] = useState('')
  const [discoverGenre, setDiscoverGenre] = useState('')

  // Pins visibles : vides au départ (carte épurée). Ils n'apparaissent que
  // lorsqu'une recherche cible un artiste (son pin) ou une ville (ses pins).
  const [visiblePins, setVisiblePins] = useState<Artist[]>([])
  /**
   * Le cadrage ne devient relâchable qu'une fois la caméra arrivée au niveau
   * de détail. Sinon il était jeté AVANT le vol — une recherche pose le pin,
   * le zoom vaut encore celui de la vue globe au rendu suivant, et le pin
   * cherché disparaissait aussitôt.
   */
  const scopeArmedRef = useRef(false)
  useEffect(() => {
    scopeArmedRef.current = false
  }, [visiblePins])
  if (isScopeArmed(mapZoom)) scopeArmedRef.current = true
  const scopeReleased = scopeArmedRef.current && shouldReleaseScope(mapZoom)

  // Lieu sélectionné (ville/pays) : panneau bas avec stats + nav artiste-à-
  // artiste. Peut venir de la recherche OU d'un clic sur un cluster de lieu.
  const [selectedPlace, setSelectedPlace] = useState<PlacePanelData | null>(null)
  const [placeIndex, setPlaceIndex] = useState(0)
  // Pin mis en évidence par la nav flèches de la mini-barre « lieu ».
  const [highlightedId, setHighlightedId] = useState<string | null>(null)

  // Artistes découverts (map_artists) chargés depuis Supabase.
  const [mapArtists, setMapArtists] = useState<Artist[]>([])
  const [onlineResults, setOnlineResults] = useState<DiscoveredArtist[]>([])
  const [searchingWeb, setSearchingWeb] = useState(false)
  const [addingId, setAddingId] = useState<string | null>(null)
  // Score de popularité (vues profil + pin) par artiste — anneaux des pins.
  const [popularityById, setPopularityById] = useState<Map<string, number>>(
    new Map(),
  )

  // Demande de référencement : artiste sans localisation → formulaire où
  // l'utilisateur complète la ville (etc.) ; l'admin validera au lieu d'un
  // ajout direct à la carte.
  const { user } = useAuth()
  const [referCandidate, setReferCandidate] = useState<DiscoveredArtist | null>(null)
  const [referForm, setReferForm] = useState({
    city: '',
    genre: '',
    email: '',
    note: '',
  })
  const [referBusy, setReferBusy] = useState(false)
  const [referError, setReferError] = useState<string | null>(null)
  const [referSent, setReferSent] = useState(false)

  // Historique de recherche : lecture asynchrone du stockage partagé.
  useEffect(() => {
    void getSearchHistory().then(setHistory)
  }, [])

  useEffect(() => {
    let cancelled = false
    void fetchMapArtists().then((rows) => {
      if (cancelled) return
      setMapArtists(rows.map((row) => toArtist(row)))
    })
    void fetchAllArtistPopularity().then((map) => {
      if (!cancelled) setPopularityById(map)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Recherche en ligne (MusicBrainz) dès que l'utilisateur tape.
  useEffect(() => {
    const q = query.trim()
    if (!q || q.length < 2) {
      setOnlineResults([])
      setSearchingWeb(false)
      return
    }
    const controller = new AbortController()
    const delay = setTimeout(() => {
      setSearchingWeb(true)
      void searchArtistOnline(q, controller.signal).then((results) => {
        // Requête dépassée (l'utilisateur a effacé ou changé de terme) : on
        // ignore les résultats tardifs pour ne jamais réafficher du périmé.
        if (controller.signal.aborted) return
        setOnlineResults(results)
        setSearchingWeb(false)
      })
    }, 450)
    return () => {
      clearTimeout(delay)
      controller.abort()
    }
  }, [query])

  // Quartiers / localités (Mapbox) pendant la saisie — détails de quartier
  // dans la recherche, comme les villes mais plus précis (Bastille, Almadies…).
  const [neighborhoodResults, setNeighborhoodResults] = useState<NeighborhoodSuggestion[]>([])
  const [searchingNeighborhoods, setSearchingNeighborhoods] = useState(false)
  useEffect(() => {
    const q = query.trim()
    if (!q || q.length < 2) {
      setNeighborhoodResults([])
      setSearchingNeighborhoods(false)
      return
    }
    const controller = new AbortController()
    const delay = setTimeout(() => {
      setSearchingNeighborhoods(true)
      void searchNeighborhoods(q, controller.signal).then((results) => {
        if (controller.signal.aborted) return
        setNeighborhoodResults(results)
        setSearchingNeighborhoods(false)
      })
    }, 350)
    return () => {
      clearTimeout(delay)
      controller.abort()
    }
  }, [query])

  const handleReady = useCallback((handle: GlobeMapHandle) => {
    mapRef.current = handle
  }, [])

  // La recherche distingue trois types de résultats : artistes (nom seul),
  // lieux (ville/pays) et genres musicaux. Source unique : la table
  // map_artists (tout pin du globe existe en base → Suivre/Like valides).
  const allArtists = useMemo(() => mapArtists, [mapArtists])

  /** Artistes dont le NOM contient la requête (pas la ville ni le genre). */
  const artistResults = useMemo(() => {
    const q = norm(query)
    if (!q) return []
    const seen = new Set<string>()
    return allArtists.filter((a) => {
      if (seen.has(a.id)) return false
      if (norm(a.name).includes(q)) {
        seen.add(a.id)
        return true
      }
      return false
    })
  }, [allArtists, query])

  /** Lieux (ville + pays) contenant la requête, regroupés et comptés. */
  const placeResults = useMemo(() => {
    const q = norm(query)
    if (!q) return []
    const map = new Map<string, { city: string; country: string; flag: string; coordinates: [number, number]; count: number }>()
    for (const a of allArtists) {
      if (!norm(`${a.city} ${a.country}`).includes(q)) continue
      // Clé normalisée : « Paris » et « paris » sont le même lieu.
      const key = `${norm(a.city)}·${norm(a.country)}`
      const current = map.get(key)
      if (current) current.count += 1
      else map.set(key, { city: a.city, country: a.country, flag: a.flag, coordinates: a.coordinates, count: 1 })
    }
    return [...map.values()]
  }, [allArtists, query])

  /** Pays contenant la requête (nom ou code ISO), regroupés et comptés. */
  const countryResults = useMemo(() => {
    const q = norm(query)
    if (!q) return []
    const map = new Map<
      string,
      { code: string; name: string; flag: string; coordinates: [number, number]; count: number }
    >()
    for (const a of allArtists) {
      const code = (a.country ?? '').toUpperCase()
      if (!code) continue
      const info = countryByName(code)
      const name = info ? info.en : (a.country ?? '')
      const flag = info ? flagFor(code) : a.flag
      const matches =
        norm(name).includes(q) ||
        code.includes(q.toUpperCase()) ||
        // Alias FR/EN du pays (ex. « Nigéria » pour NG) via le dataset partagé.
        (info && (norm(info.fr).includes(q) || norm(info.en).includes(q)))
      if (!matches) continue
      const current = map.get(code)
      if (current) current.count += 1
      else
        map.set(code, {
          code,
          name,
          flag,
          coordinates: a.coordinates,
          count: 1,
        })
    }
    return [...map.values()].sort((a, b) => b.count - a.count)
  }, [allArtists, query])

  /** Genres musicaux contenant la requête, regroupés et comptés. */
  const genreResults = useMemo(() => {
    const q = norm(query)
    if (!q) return []
    const map = new Map<string, { genre: string; count: number }>()
    for (const a of allArtists) {
      if (!a.genre || !norm(a.genre).includes(q)) continue
      const current = map.get(a.genre)
      map.set(a.genre, { genre: a.genre, count: (current?.count ?? 0) + 1 })
    }
    return [...map.values()]
  }, [allArtists, query])

  /** Pins affichés en direct pendant la saisie : les artistes dont le nom
   *  correspond + tous ceux des lieux / pays / genres qui correspondent.
   *  Vide si rien ne correspond — on ne retombe JAMAIS sur « tous les pins ». */
  const livePins = useMemo(() => {
    const q = norm(query)
    if (!q) return []
    const ids = new Set<string>()
    const out: Artist[] = []
    const push = (a: Artist) => {
      if (ids.has(a.id)) return
      ids.add(a.id)
      out.push(a)
    }
    for (const a of artistResults) push(a)
    for (const p of placeResults) {
      for (const a of allArtists) {
        if (a.city === p.city && a.country === p.country) push(a)
      }
    }
    for (const c of countryResults) {
      for (const a of allArtists) {
        if ((a.country ?? '').toUpperCase() === c.code.toUpperCase()) push(a)
      }
    }
    for (const g of genreResults) {
      for (const a of allArtists) {
        if (a.genre === g.genre) push(a)
      }
    }
    // Quartiers : les artistes situés à ≤ ~4,4 km du quartier.
    for (const n of neighborhoodResults) {
      for (const a of allArtists) {
        if (
          Math.abs(a.coordinates[0] - n.lng) <= 0.04 &&
          Math.abs(a.coordinates[1] - n.lat) <= 0.04
        ) {
          push(a)
        }
      }
    }
    return out
  }, [query, artistResults, placeResults, countryResults, genreResults, neighborhoodResults, allArtists])

  // Pendant la saisie : les pins correspondants apparaissent en direct derrière
  // le panneau. Avec une requête vide, on GARDE les pins de la dernière cible
  // (ouvrir/fermer la recherche ne doit jamais réafficher tout le monde).
  useEffect(() => {
    if (!searchOpen) return
    if (query.trim()) setVisiblePins(livePins)
  }, [searchOpen, query, livePins])

  // Artistes a moins de 500 km, pour l'onglet Nearby
  const nearby = useMemo(() => {
    if (!selected) return []
    const all = mapArtists
    return all
      .filter((a) => a.id !== selected.id)
      .map((a) => ({ artist: a, d: distanceKm(selected.coordinates, a.coordinates) }))
      .filter(({ d }) => d < 500)
      .sort((a, b) => a.d - b.d)
      .map(({ artist }) => artist)
  }, [selected, mapArtists])

  /** Enregistre la requête courante dans l'historique (si non vide). */
  const rememberQuery = useCallback((raw: string) => {
    const q = raw.trim()
    if (!q) return
    void addSearchHistory(q).then(setHistory)
  }, [])

  const goToArtist = useCallback(
    (artist: Artist, rawQuery?: string) => {
      rememberQuery(rawQuery ?? query)
      setSelected(artist)
      setSearchOpen(false)
      setQuery('')
      setVisiblePins([artist])
      // Vol sur la position AFFICHEE du pin (des-empilement inclus), pas sur
      // la coordonnee brute : a z13 la spirale peut le decaler de plusieurs
      // centaines de px, et l'artiste cherche finissait en peripherie.
      mapRef.current?.focusArtist(artist.id)
      // Statistiques : une ouverture de fiche depuis la carte = vue pin
      // (clé d'appareil incluse : vues uniques par user / par appareil).
      void recordPinView(artist.id)
    },
    [query, rememberQuery],
  )

  const goToCity = useCallback(
    (c: { city: string; country: string; coordinates: [number, number] }) => {
      rememberQuery(`${c.city}, ${c.country}`)
      // Les pins de la zone : artistes du catalogue + découverts dans la ville.
      const qCity = c.city.trim().toLowerCase()
      const qCountry = c.country.trim().toLowerCase()
      const cityArtists = allArtists.filter(
        (a) =>
          a.city.trim().toLowerCase() === qCity &&
          a.country.trim().toLowerCase() === qCountry,
      )
      setSearchOpen(false)
      setQuery('')
      setSelected(null)
      setHighlightedId(null)
      setVisiblePins(cityArtists.length > 0 ? cityArtists : [])
      // Panneau « lieu » : stats de la ville + nav artiste-à-artiste.
      const code = geoCountryOf(c.city, c.country)
      setSelectedPlace({
        kind: 'city',
        name: c.city,
        code,
        flag: flagFor(code),
        artists: cityArtists,
      })
      setPlaceIndex(0)
      // Atterrit sur le PREMIER pin de la ville (position dés-empilée) :
      // comme un clic sur cluster, on ne tombe jamais dans le vide.
      if (cityArtists.length > 0) {
        const firstArtist = cityArtists[0]
        if (firstArtist) {
          setHighlightedId(firstArtist.id)
          mapRef.current?.focusFirst(cityArtists, CAMERA.city.zoom)
          return
        }
      }
      mapRef.current?.flyTo(c.coordinates, CAMERA.city.zoom)
    },
    [allArtists, rememberQuery],
  )

  const goToNeighborhood = useCallback(
    (n: NeighborhoodSuggestion) => {
      rememberQuery(n.name)
      // Quartier : les artistes « proches » (≤ ~4,5 km) de ce quartier.
      const radius = 0.04 // degrés (~4,4 km) — quartier ≠ ville
      const qLng = n.lng
      const qLat = n.lat
      const nearArtists = allArtists.filter((a) => {
        const dLng = Math.abs(a.coordinates[0] - qLng)
        const dLat = Math.abs(a.coordinates[1] - qLat)
        return dLng <= radius && dLat <= radius
      })
      setSearchOpen(false)
      setQuery('')
      setSelected(null)
      setHighlightedId(null)
      setVisiblePins(nearArtists.length > 0 ? nearArtists : [])
      // Panneau « lieu » : stats + nav artiste-à-artiste (comme une ville).
      const code = n.countryCode ?? ''
      setSelectedPlace({
        kind: 'city',
        name: n.name,
        code,
        flag: flagFor(code),
        artists: nearArtists,
      })
      setPlaceIndex(0)
      // 14 = niveau rue : les pins du quartier sont bien détachés.
      mapRef.current?.flyTo([n.lng, n.lat], CAMERA.place.zoom)
    },
    [allArtists, rememberQuery],
  )

  const goToCountry = useCallback(
    (c: { code: string; name: string; flag: string; coordinates: [number, number] }) => {
      rememberQuery(c.name)
      // Les pins de ce pays : tous les artistes du pays, centrés dessus.
      const countryArtists = allArtists.filter(
        (a) => (a.country ?? '').toUpperCase() === c.code.toUpperCase(),
      )
      setSearchOpen(false)
      setQuery('')
      setSelected(null)
      setHighlightedId(null)
      setVisiblePins(countryArtists.length > 0 ? countryArtists : [])
      // Panneau « lieu » : stats du pays + nav artiste-à-artiste.
      setSelectedPlace({
        kind: 'country',
        name: c.name,
        code: c.code,
        flag: c.flag,
        artists: countryArtists,
      })
      setPlaceIndex(0)
      // Barycentre des artistes du pays (plus précis que la première
      // coordonnée, surtout pour les grands pays). Repli : coordonnée du
      // premier résultat.
      const center: [number, number] =
        countryArtists.length > 1
          ? ([
              countryArtists.reduce((s, a) => s + a.coordinates[0], 0) /
                countryArtists.length,
              countryArtists.reduce((s, a) => s + a.coordinates[1], 0) /
                countryArtists.length,
            ] as [number, number])
          : c.coordinates
      // 12 = niveau quartier : pendant le vol le clustering se met à jour
      // en continu et les pins apparaissent progressivement, détachés.
      mapRef.current?.flyTo(center, CAMERA.country.zoom)
    },
    [allArtists, rememberQuery],
  )

  // Navigation artiste-à-artiste dans le lieu sélectionné : saute à
  // l'artiste (vol + highlight) sans quitter la carte. Le pin cible est mis
  // en évidence (grossi + nom affiché) pendant que la carte vole vers lui.
  const jumpPlaceArtist = useCallback(
    (i: number) => {
      setPlaceIndex(i)
      const artist = selectedPlace?.artists[i]
      if (artist) {
        setSelected(null)
        setHighlightedId(artist.id)
        // Vole vers la position AFFICHÉE du pin (dés-empilement inclus) pour
        // qu'il arrive au centre de l'écran — pas dans un coin.
        mapRef.current?.focusArtist(artist.id)
      }
    },
    [selectedPlace],
  )

  const goToGenre = useCallback(
    (genre: string) => {
      rememberQuery(genre)
      // Les pins des artistes de ce genre : tous visibles, cliquables.
      const genreArtists = allArtists.filter((a) => a.genre === genre)
      setSearchOpen(false)
      setQuery('')
      setSelected(null)
      setHighlightedId(null)
      setVisiblePins(genreArtists)
      if (genreArtists.length > 0) {
        mapRef.current?.flyTo(genreArtists[0].coordinates, CAMERA.genre.zoom)
      }
    },
    [allArtists, rememberQuery],
  )

  // --- Découverte : artistes filtrés par ville et/ou genre, tirés au hasard ---

  /** Villes distinctes (triées) et genres distincts pour les filtres. */
  const discoverCities = useMemo(() => {
    const set = new Set(allArtists.map((a) => a.city.trim()).filter(Boolean))
    return [...set].sort((a, b) => a.localeCompare(b, 'fr'))
  }, [allArtists])

  const discoverGenres = useMemo(() => {
    const set = new Set(allArtists.map((a) => a.genre.trim()).filter(Boolean))
    return [...set].sort((a, b) => a.localeCompare(b, 'fr'))
  }, [allArtists])

  /** Pool filtré par les sélecteurs ville/genre du panneau Découverte. */
  const discoverPool = useMemo(() => {
    const seen = new Set<string>()
    return allArtists.filter((a) => {
      if (seen.has(a.id)) return false
      if (discoverCity && a.city.trim().toLowerCase() !== discoverCity.trim().toLowerCase()) return false
      if (discoverGenre && a.genre.trim().toLowerCase() !== discoverGenre.trim().toLowerCase()) return false
      seen.add(a.id)
      return true
    })
  }, [allArtists, discoverCity, discoverGenre])

  /** Tire un artiste au hasard dans le pool et ouvre sa fiche. */
  const discoverRandom = useCallback(() => {
    if (discoverPool.length === 0) {
      toast.error(t('globe.discoverEmpty'))
      return
    }
    const pick = discoverPool[Math.floor(Math.random() * discoverPool.length)]
    goToArtist(pick)
  }, [discoverPool, goToArtist, t])

  // Ouvre le formulaire « Demander le référencement » pré-rempli avec les
  // infos déjà trouvées (nom, genre, bio, liens). La ville est à compléter
  // par l'utilisateur : sans elle, impossible de placer le pin — l'admin
  // validera ensuite la demande depuis la liste d'attente.
  const openRefer = useCallback((candidate: DiscoveredArtist) => {
    setReferCandidate(candidate)
    setReferForm({
      city: candidate.city || '',
      genre: candidate.genre || '',
      email: user?.email ?? '',
      note: candidate.bio?.slice(0, 280) || '',
    })
    setReferError(null)
    setReferSent(false)
  }, [user])

  const closeRefer = useCallback(() => {
    setReferCandidate(null)
    setReferSent(false)
    setReferError(null)
  }, [])

  // Envoi de la demande : enregistrée dans la liste d'attente (profil
  // artiste), comme le formulaire /artistes — l'admin la convertit ensuite
  // en pin via l'admin (Liste d'attente → « Carte »).
  const submitRefer = useCallback(async () => {
    if (!referCandidate) return
    const city = referForm.city.trim()
    if (!city) return setReferError(t('discovery.referCityRequired'))
    if (!isValidEmail(referForm.email)) return setReferError(t('discovery.referEmailRequired'))
    setReferBusy(true)
    setReferError(null)
    try {
      await saveSignup(
        {
          email: referForm.email.trim(),
          profile: 'artiste',
          artistName: referCandidate.name,
          city,
          genre: referForm.genre.trim(),
          bio: referForm.note.trim() || undefined,
          spotify: referCandidate.platforms?.spotify || undefined,
          youtube: referCandidate.platforms?.youtube || undefined,
          instagram: referCandidate.socials?.instagram || undefined,
          link:
            referCandidate.platforms?.spotify ||
            referCandidate.platforms?.youtube ||
            referCandidate.socials?.instagram ||
            undefined,
        },
        { userId: user?.id },
      )
      setReferSent(true)
      // Retire le candidat de la liste : la demande est enregistrée.
      setOnlineResults((prev) => prev.filter((r) => r.id !== referCandidate.id))
    } catch {
      setReferError(t('discovery.referFailed'))
    } finally {
      setReferBusy(false)
    }
  }, [referCandidate, referForm, t, user])

  const referField =
    'w-full rounded-2xl border border-hairline-strong bg-surface px-4 py-3 outline-none focus:ring-2 focus:ring-brand-deep'

  // Ajoute un artiste découvert à la carte : insertion si absent, mise à
  // jour du profil existant sinon (par nom). Puis redirection vers l'artiste.
  const addToMap = useCallback(
    async (candidate: DiscoveredArtist) => {
      setAddingId(candidate.id)
      const located = await locateArtist(candidate)
      if (located.error || !located.artist?.lat || !located.artist.lng) {
        setAddingId(null)
        // Localisation inconnue : plutôt que de bloquer, on propose la
        // demande de référencement (l'utilisateur complète la ville, l'admin
        // validera).
        toast.error(t('discovery.locationMissing'), {
          description: t('discovery.referHint'),
          action: {
            label: t('discovery.refer'),
            onClick: () => openRefer(candidate),
          },
        })
        return
      }
      const fresh = located.artist
      const nameKey = fresh.name.trim().toLowerCase()

      // 1) Déjà sur la carte ? Mise à jour du profil existant (même pin).
      // (l'ancien chemin « catalogue éditorial » a été supprimé : tous les
      // artistes du globe vivent désormais dans map_artists)
      const existing = mapArtists.find(
        (a) => a.name.trim().toLowerCase() === nameKey,
      ) as MapArtistView | undefined
      let artist: Artist
      if (existing) {
        const result = await addOrUpdateMapArtist({
          ...fresh,
          id: existing.id, // on conserve l'identifiant du pin existant
        })
        if (!result.ok) {
          // Le RPC n'existe pas encore (migration 00018 absente) : on
          // redirige quand même vers l'artiste déjà présent.
          setAddingId(null)
          setOnlineResults((prev) => prev.filter((r) => r.id !== candidate.id))
          setSearchOpen(false)
          setQuery('')
          setSelected(existing)
          setVisiblePins([existing])
          mapRef.current?.focusArtist(existing.id)
          return
        }
        // Fusion : le neuf enrichit, l'ancien conserve modération + vides.
        artist = {
          ...existing,
          ...toArtist(fresh),
          id: existing.id,
          verified: existing.verified,
          claimedBy: existing.claimedBy,
          bio: fresh.bio || existing.bio,
          image: fresh.image || existing.image,
          genre: fresh.genre || existing.genre,
          city: fresh.city || existing.city,
          country: fresh.country || existing.country,
          platforms: { ...existing.platforms, ...fresh.platforms },
          socials: { ...existing.socials, ...fresh.socials },
        }
        setMapArtists((prev) => prev.map((a) => (a.id === existing.id ? artist : a)))
        toast.success(t('discovery.updated'))
      } else {
        // 3) Nouvel artiste : insertion (RPC, avec repli sur l'ancien upsert).
        const result = await addOrUpdateMapArtist(fresh)
        if (!result.ok) {
          const fallback = await addMapArtist(fresh)
          if (!fallback.ok) {
            setAddingId(null)
            toast.error(t('discovery.error'))
            return
          }
        }
        artist = toArtist(fresh)
        setMapArtists((prev) => [...prev.filter((a) => a.id !== artist.id), artist])
        toast.success(t('discovery.added'))
      }

      // Redirection : ferme la recherche, ouvre la fiche et vole vers le pin.
      setAddingId(null)
      setOnlineResults((prev) => prev.filter((r) => r.id !== candidate.id))
      setSearchOpen(false)
      setQuery('')
      setSelected(artist)
      setVisiblePins([artist])
      mapRef.current?.focusArtist(artist.id)
    },
    [mapArtists, t, openRefer],
  )

  return (
    <div className="fixed inset-0 overflow-hidden bg-secondary-bg">
      {hasMapboxToken ? (
        <GlobeMap
          className="absolute inset-0 cursor-grab active:cursor-grabbing"
          onReady={handleReady}
          // En mode édition, cliquer un pin ouvre le correcteur au lieu de la
          // fiche : c'est le geste que l'admin répète, il ne doit pas passer
          // par une fiche publique qu'il devra refermer à chaque artiste.
          onSelectArtist={(artist) => {
            if (editMode) {
              setEditArtist(artist)
              setMovedTo(null)
            } else {
              goToArtist(artist)
            }
          }}
          editable={editMode}
          onMoveArtist={(artist, coordinates) => {
            setEditArtist(artist)
            setMovedTo(coordinates)
          }}
          autoRotate={spinning}
          onAutoRotateChange={setSpinning}
          onZoomChange={(z) => setMapZoom((prev) => (prev === z ? prev : z))}
          theme={theme}
          // Par défaut : tous les artistes de la carte sont épinglés, mais très
          // petits de loin (l'échelle dépend du zoom). Dès qu'une recherche ou
          // une sélection cible des artistes, seuls ceux-là restent affichés.
          // Le clustering (pays → ville → artistes) évite la surcharge en vue
          // monde : les noms d'artistes ne s'affichent qu'en zoom rapproché.
          // Pins STRICTEMENT limités à la cible : une recherche active sans
          // résultat affiche une carte vide ([]), jamais tous les artistes.
          // Au dézoom, on relâche le cadrage posé par un clic sur cluster ou
          // une recherche : sinon la carte reste figée sur ce seul groupe et
          // les autres clusters ne réapparaissent jamais.
          visibleArtists={
            visiblePins.length > 0 && !scopeReleased
              ? visiblePins
              : searchOpen && query.trim()
                ? []
                : undefined
          }
          extraArtists={mapArtists}
          popularityById={popularityById}
          highlightedArtistId={highlightedId}
          cluster
          showPins
          // Clic sur un cluster : scope les pins aux artistes du cluster
          // (jamais de pins de pays voisins au bord du viewport). Si c'est un
          // cluster de LIEU (pays/ville), le panneau bas s'ouvre aussi.
          onClusterFocus={(artists, place) => {
            setVisiblePins(artists)
            setSelected(null)
            // Le premier pin du cluster est mis en évidence : le vol atterrit
            // dessus (position dés-empilée), pas dans le vide du barycentre.
            // Les flèches de la mini-barre naviguent de pin en pin ensuite.
            setHighlightedId(artists[0]?.id ?? null)
            if (place) {
              setSelectedPlace({ ...place, artists })
              setPlaceIndex(0)
            } else {
              setSelectedPlace(null)
            }
          }}
        />
      ) : (
        <MapboxTokenNotice />
      )}

      {/* Logo Musimaps vers l'accueil (la page globe n'a pas de navbar).
          Thème-aware et responsive comme la navbar : logo horizontal sur
          desktop, icône seule sur mobile (blanche en sombre / bleue en clair).
          Masqué quand un artiste est sélectionné : le bouton « Retour » de la
          fiche prend sa place (évite le chevauchement des deux boutons). */}
      {!selected && (
        <Link
          to={localize('/')}
          aria-label={t('globe.backHomeAria')}
          className="absolute left-4 top-5 z-30 block sm:left-6"
        >
          <img
            src={navbarLogo}
            alt="Musimaps"
            className="hidden w-auto md:block"
            style={{ height: navbarLogoHeight, maxHeight: 140 }}
          />
          <img
            src={theme === 'dark' ? iconWhite : iconBlue}
            alt="Musimaps"
            className="block w-auto md:hidden"
            style={{ height: Math.round(navbarLogoHeight * 1.05), maxHeight: 44 }}
          />
        </Link>
      )}

      {/* Barre de recherche — se replie en icône (coin haut droit, animée)
          dès qu'on zoome sur la carte ou qu'une fiche s'ouvre ; un clic sur
          l'icône ramène la recherche. */}
      {!searchOpen && (
        <>
          <div
            aria-hidden={searchCollapsed}
            className={`pointer-events-none absolute inset-x-0 top-0 z-20 px-4 pt-44 transition-all duration-300 sm:px-6 ${
              searchCollapsed ? 'search-bar-collapsing' : ''
            }`}
          >
            <button
              type="button"
              onClick={() => {
                // La fiche et le panneau de recherche ne coexistent pas :
                // ouvrir la recherche referme la fiche (sinon les deux
                // overlays se superposent — bouton « Retour » sur le globe).
                setSelected(null)
                setSearchOpen(true)
              }}
              tabIndex={searchCollapsed ? -1 : 0}
              className={`mx-auto flex w-full max-w-2xl items-center gap-3 rounded-full bg-surface/85 px-5 py-4 text-left shadow-lg backdrop-blur-xl transition-colors hover:bg-surface ${
                searchCollapsed ? 'pointer-events-none' : 'pointer-events-auto'
              }`}
            >
              <Search className="h-5 w-5 shrink-0 text-secondary-text" />
              <span className="flex-1 text-secondary-text">{t('globe.searchPlaceholder')}</span>
            </button>
          </div>

          {/* Icône recherche — réapparaît (pop + anneau pulsé) quand la barre
              se replie, et permet de rouvrir la recherche à tout moment. */}
          <button
            key={searchCollapsed ? 'search-on' : 'search-off'}
            type="button"
            onClick={() => {
              setSelected(null)
              setSearchOpen(true)
            }}
            aria-label={t('globe.searchPlaceholder')}
            aria-hidden={!searchCollapsed}
            tabIndex={searchCollapsed ? 0 : -1}
            className={`absolute right-4 top-6 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-surface/90 text-brand-deep shadow-lg backdrop-blur-xl transition-colors hover:bg-surface sm:right-6 ${
              searchCollapsed ? 'search-icon opacity-100' : 'pointer-events-none opacity-0'
            }`}
          >
            <span className="search-icon__ring" />
            <Search className="h-5 w-5" />
          </button>
        </>
      )}

      {/* Panneau « lieu » : stats de la ville/pays + nav artiste-à-artiste */}
      {selectedPlace && !searchOpen && (
        <div className={selected ? 'hidden sm:block' : ''}>
          <PlacePanel
            place={selectedPlace}
            index={placeIndex}
            onJump={jumpPlaceArtist}
            onSelect={(a) => {
              // Clic sur un artiste du lieu : ouvre sa fiche (goToArtist vole
              // déjà vers lui) ; à la fermeture, on revient aux pins du lieu.
              goToArtist(a)
            }}
            onClose={() => {
              setSelectedPlace(null)
              setPlaceIndex(0)
              setHighlightedId(null)
            }}
          />
        </div>
      )}

      {/* Controles : retour vue globe + rotation auto */}
      {!selected && (
        <div className="pointer-events-none absolute bottom-6 left-0 right-0 z-20 flex flex-wrap justify-center gap-3 px-4">
          <button
            type="button"
            onClick={() => {
              setSelected(null)
              setSelectedPlace(null)
              setPlaceIndex(0)
              setHighlightedId(null)
              setVisiblePins([])
              mapRef.current?.resetView()
            }}
            className="pointer-events-auto flex items-center gap-2 rounded-full bg-surface/85 px-5 py-3 text-sm font-medium shadow-lg backdrop-blur-xl transition-colors hover:bg-surface"
          >
            <Globe2 className="h-4 w-4 text-brand-deep" /> {t('globe.globeView')}
          </button>
          {hasMapboxToken && (
            <RotateToggle
              active={spinning}
              onToggle={() => setSpinning((s) => !s)}
              // Le globe est toujours sombre (3D spatial) : la variante « dark »
              // donne un cercle blanc translucide visible dans les deux thèmes.
              theme="dark"
              className="pointer-events-auto"
            />
          )}
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                setEditMode((on) => !on)
                setEditArtist(null)
                setMovedTo(null)
              }}
              title={t('mapAdmin.hint')}
              aria-pressed={editMode}
              className={`pointer-events-auto flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium shadow-lg backdrop-blur-xl transition-colors ${
                editMode
                  ? 'bg-brand text-black'
                  : 'bg-surface/85 hover:bg-surface'
              }`}
            >
              <Pencil className="h-4 w-4" />
              {editMode ? t('mapAdmin.disable') : t('mapAdmin.enable')}
            </button>
          )}
        </div>
      )}

      {/* Correcteur admin — ouvert par un clic sur pin en mode édition. */}
      {isAdmin && editMode && editArtist && (
        <AdminArtistEditor
          artist={editArtist}
          pendingCoordinates={movedTo}
          onClose={() => {
            setEditArtist(null)
            setMovedTo(null)
          }}
          onSaved={(patch) => {
            // La carte lit `mapArtists` : on y répercute la correction sans
            // refaire un aller-retour réseau, sinon le pin saute à son
            // ancienne place le temps du rechargement.
            setMapArtists((list) =>
              list.map((a) =>
                a.id === editArtist.id
                  ? {
                      ...a,
                      name: patch.name ?? a.name,
                      genre: patch.genre ?? a.genre,
                      district: patch.district ?? a.district,
                      city: patch.city ?? a.city,
                      country: patch.country ?? a.country,
                      coordinates: patch.coordinates ?? a.coordinates,
                    }
                  : a,
              ),
            )
            setMovedTo(null)
          }}
        />
      )}

      {/* Panneau de recherche */}
      {searchOpen && (
        <div className="absolute inset-0 z-40 flex flex-col justify-end bg-black/20 backdrop-blur-sm">
          <button
            type="button"
            aria-label={t('globe.closeSearch')}
            className="w-full flex-1"
            onClick={() => {
              // Ferme le panneau en gardant les pins de la dernière cible :
              // jamais de retour à « tous les artistes ».
              setSearchOpen(false)
              setQuery('')
            }}
          />
          <div className="sheet-in mx-auto w-full max-w-2xl rounded-t-[2rem] bg-surface p-5 shadow-2xl sm:mb-6 sm:rounded-[1.75rem] sm:p-6">
            <div className="w-full">
              <div className="relative mb-5 flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => {
                    setSearchOpen(false)
                    setQuery('')
                  }}
                  aria-label={t('globe.back')}
                  className="absolute left-0 flex h-10 w-10 items-center justify-center rounded-full bg-surface shadow-md"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <h2 className="display-font text-lg font-bold">{t('globe.searchPlaceholder')}</h2>
              </div>

              <div className="relative mb-4 border-t border-hairline pt-5">
                <Search className="absolute left-5 top-1/2 h-5 w-5 translate-y-1 text-secondary-text" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    // Entrée : mémorise la requête dans l'historique.
                    if (e.key === 'Enter') {
                      rememberQuery(query)
                      // S'il y a un seul artiste clair, on s'y rend.
                      if (artistResults.length === 1 && placeResults.length === 0 && genreResults.length === 0) {
                        goToArtist(artistResults[0], query)
                      }
                    }
                  }}
                  placeholder={t('globe.searchPh')}
                  className="w-full rounded-full border border-hairline-strong py-4 pl-14 pr-12 outline-none focus:ring-2 focus:ring-brand-deep"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    aria-label={t('globe.clear')}
                    className="absolute right-5 top-1/2 translate-y-1 text-secondary-text hover:text-primary-text"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>

              <div className="no-scrollbar max-h-[45vh] overflow-y-auto">
                {!query && (
                  <div className="space-y-6 pb-2">
                    {/* Historique de recherche */}
                    <section>
                      <div className="flex items-center justify-between px-2">
                        <h3 className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-secondary-text">
                          <History className="h-3.5 w-3.5" /> {t('globe.history')}
                        </h3>
                        {history.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              void clearSearchHistory().then(() => setHistory([]))
                            }}
                            className="text-xs font-medium text-secondary-text underline-offset-2 hover:underline"
                          >
                            {t('globe.clearHistory')}
                          </button>
                        )}
                      </div>
                      {history.length === 0 ? (
                        <p className="px-2 pt-2 text-sm text-secondary-text">{t('globe.historyEmpty')}</p>
                      ) : (
                        <div className="flex flex-wrap gap-2 pt-3">
                          {history.map((item) => (
                            <button
                              key={item}
                              type="button"
                              onClick={() => setQuery(item)}
                              className="flex items-center gap-1.5 rounded-full bg-secondary-bg px-3.5 py-1.5 text-sm font-medium transition-colors hover:bg-brand-soft hover:text-brand-deep"
                            >
                              <History className="h-3.5 w-3.5 opacity-60" />
                              {item}
                            </button>
                          ))}
                        </div>
                      )}
                    </section>

                    {/* Découverte : tirage aléatoire filtré ville/genre */}
                    <section className="rounded-2xl border border-hairline bg-secondary-bg/50 p-4">
                      <h3 className="flex items-center gap-1.5 px-1 text-xs uppercase tracking-widest text-secondary-text">
                        <Shuffle className="h-3.5 w-3.5" /> {t('globe.discover')}
                      </h3>
                      <p className="px-1 pt-1.5 text-sm text-secondary-text">{t('globe.discoverSub')}</p>
                      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <label className="block">
                          <span className="sr-only">{t('globe.discoverCity')}</span>
                          <select
                            value={discoverCity}
                            onChange={(e) => setDiscoverCity(e.target.value)}
                            className="w-full rounded-full border border-hairline-strong bg-surface px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-deep"
                          >
                            <option value="">{t('globe.discoverCity')}</option>
                            {discoverCities.map((city) => (
                              <option key={city} value={city}>
                                {city}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block">
                          <span className="sr-only">{t('globe.discoverGenre')}</span>
                          <select
                            value={discoverGenre}
                            onChange={(e) => setDiscoverGenre(e.target.value)}
                            className="w-full rounded-full border border-hairline-strong bg-surface px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-deep"
                          >
                            <option value="">{t('globe.discoverGenre')}</option>
                            {discoverGenres.map((genre) => (
                              <option key={genre} value={genre}>
                                {genre}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 px-1">
                        <button
                          type="button"
                          onClick={() => void discoverRandom()}
                          disabled={discoverPool.length === 0}
                          className="flex items-center gap-2 rounded-full bg-brand-deep px-5 py-2.5 text-sm font-bold text-brand-deep-foreground transition-transform hover:scale-105 disabled:opacity-50"
                        >
                          <Shuffle className="h-4 w-4" />
                          {t('globe.discoverShuffle')}
                        </button>
                        <span className="text-xs text-secondary-text">
                          {t('globe.discoverPool', {
                            count: discoverPool.length,
                            s: discoverPool.length > 1 ? 's' : '',
                          })}
                        </span>
                      </div>
                    </section>

                    <p className="px-2 text-center text-sm text-secondary-text">{t('globe.hint')}</p>
                  </div>
                )}

                {query &&
                  countryResults.length === 0 &&
                  placeResults.length === 0 &&
                  neighborhoodResults.length === 0 &&
                  artistResults.length === 0 &&
                  genreResults.length === 0 &&
                  onlineResults.length === 0 &&
                  !searchingWeb &&
                  !searchingNeighborhoods && (
                    <p className="py-8 text-center text-sm text-secondary-text">
                      {t('globe.noResults', { query })}
                    </p>
                  )}

                {searchingWeb && (
                  <p className="flex items-center justify-center gap-2 py-6 text-sm text-secondary-text">
                    <Loader2 className="h-4 w-4 animate-spin" /> {t('discovery.searching')}
                  </p>
                )}

                {countryResults.length > 0 && (
                  <>
                    <h3 className="px-2 pb-2 pt-3 text-xs uppercase tracking-widest text-secondary-text">
                      <Globe2 className="mr-1 inline h-3 w-3" /> {t('globe.countries')}
                    </h3>
                    <ul>
                      {countryResults.map((c) => (
                        <li key={c.code}>
                          <button
                            type="button"
                            onClick={() => goToCountry(c)}
                            className="flex w-full items-center gap-4 rounded-2xl p-3 text-left transition-colors hover:bg-secondary-bg"
                          >
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-lg">
                              {c.flag}
                            </span>
                            <span className="flex-1">
                              <span className="block font-medium">{c.name}</span>
                              <span className="block text-sm text-secondary-text">
                                {t('globe.countryArtists', {
                                  count: c.count,
                                  s: c.count > 1 ? 's' : '',
                                })}
                              </span>
                            </span>
                            <span className="shrink-0 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-deep">
                              {t('globe.typeCountry')}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {neighborhoodResults.length > 0 && (
                  <>
                    <h3 className="px-2 pb-2 pt-3 text-xs uppercase tracking-widest text-secondary-text">
                      <MapPin className="mr-1 inline h-3 w-3" /> {t('globe.neighborhoods')}
                    </h3>
                    <ul>
                      {neighborhoodResults.map((n) => (
                        <li key={`${n.name}·${n.lng}·${n.lat}`}>
                          <button
                            type="button"
                            onClick={() => goToNeighborhood(n)}
                            className="flex w-full items-center gap-4 rounded-2xl p-3 text-left transition-colors hover:bg-secondary-bg"
                          >
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-deep">
                              <MapPin className="h-5 w-5" />
                            </span>
                            <span className="flex-1">
                              <span className="block font-medium">{n.name}</span>
                              <span className="block text-sm text-secondary-text">
                                {[n.city, n.country].filter(Boolean).join(', ') || '—'}
                              </span>
                            </span>
                            <span className="shrink-0 rounded-full bg-secondary-bg px-2.5 py-1 text-xs font-semibold text-secondary-text">
                              {t('globe.typeNeighborhood')}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {placeResults.length > 0 && (
                  <>
                    <h3 className="px-2 pb-2 pt-3 text-xs uppercase tracking-widest text-secondary-text">
                      <MapPin className="mr-1 inline h-3 w-3" /> {t('globe.places')}
                    </h3>
                    <ul>
                      {placeResults.map((c) => (
                        <li key={`${c.city}·${c.country}`}>
                          <button
                            type="button"
                            onClick={() => goToCity(c)}
                            className="flex w-full items-center gap-4 rounded-2xl p-3 text-left transition-colors hover:bg-secondary-bg"
                          >
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-deep">
                              <MapPin className="h-5 w-5" />
                            </span>
                            <span className="flex-1">
                              <span className="block font-medium">
                                {c.flag} {c.city}
                              </span>
                              <span className="block text-sm text-secondary-text">
                                {c.country} ·{' '}
                                {t('globe.placeArtists', {
                                  count: c.count,
                                  s: c.count > 1 ? 's' : '',
                                })}
                              </span>
                            </span>
                            <span className="shrink-0 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-deep">
                              {t('globe.typePlace')}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {artistResults.length > 0 && (
                  <>
                    <h3 className="px-2 pb-2 pt-3 text-xs uppercase tracking-widest text-secondary-text">
                      <Mic2 className="mr-1 inline h-3 w-3" /> {t('globe.artists')}
                    </h3>
                    <ul>
                      {artistResults.map((a) => (
                        <li key={a.id}>
                          <button
                            type="button"
                            onClick={() => goToArtist(a)}
                            className="flex w-full items-center gap-4 rounded-2xl p-3 text-left transition-colors hover:bg-secondary-bg"
                          >
                            <AnimatedAvatar
                              name={a.name}
                              image={a.image}
                              className="h-11 w-11 rounded-full"
                              initialsClassName="bg-gradient-to-br from-brand-deep to-brand text-sm font-bold text-black"
                            />
                            <span className="flex-1">
                              <span className="block font-medium">{a.name}</span>
                              <span className="block text-sm text-secondary-text">
                                {a.genre} · {[a.city, a.country].filter(Boolean).join(', ') || '—'}
                              </span>
                            </span>
                            <span className="flex shrink-0 flex-col items-end gap-1">
                              {a.verified && (
                                <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-black">
                                  ✓
                                </span>
                              )}
                              <span className="rounded-full bg-secondary-bg px-2.5 py-1 text-xs font-semibold text-secondary-text">
                                {t('globe.typeArtist')}
                              </span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {genreResults.length > 0 && (
                  <>
                    <h3 className="px-2 pb-2 pt-3 text-xs uppercase tracking-widest text-secondary-text">
                      <Music2 className="mr-1 inline h-3 w-3" /> {t('globe.genres')}
                    </h3>
                    <ul>
                      {genreResults.map((g) => (
                        <li key={g.genre}>
                          <button
                            type="button"
                            onClick={() => goToGenre(g.genre)}
                            className="flex w-full items-center gap-4 rounded-2xl p-3 text-left transition-colors hover:bg-secondary-bg"
                          >
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-deep to-brand text-sm font-bold text-black">
                              <Music2 className="h-5 w-5" />
                            </span>
                            <span className="flex-1">
                              <span className="block font-medium">{g.genre}</span>
                              <span className="block text-sm text-secondary-text">
                                {t('globe.genreArtists', {
                                  count: g.count,
                                  s: g.count > 1 ? 's' : '',
                                })}
                              </span>
                            </span>
                            <span className="shrink-0 rounded-full bg-secondary-bg px-2.5 py-1 text-xs font-semibold text-secondary-text">
                              {t('globe.typeGenre')}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {/* Suggestions en ligne : artistes pas encore sur la carte */}
                {onlineResults.length > 0 && (
                  <>
                    <h3 className="px-2 pb-2 pt-3 text-xs uppercase tracking-widest text-secondary-text">
                      {t('discovery.title')}
                    </h3>
                    <ul>
                      {onlineResults.map((candidate) => (
                        <li
                          key={candidate.id}
                          className="rounded-2xl border border-hairline p-3 transition-colors hover:bg-secondary-bg"
                        >
                          <div className="flex items-center gap-4">
                            <AnimatedAvatar
                              name={candidate.name}
                              image={candidate.image}
                              className="h-11 w-11 rounded-full"
                              initialsClassName="bg-gradient-to-br from-brand-deep to-brand text-sm font-bold text-black"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="flex items-center gap-2 truncate font-medium">
                                {candidate.name}
                                <span className="shrink-0 rounded-full bg-secondary-bg px-2 py-0.5 text-[10px] font-semibold text-secondary-text">
                                  {t('globe.typeArtist')}
                                </span>
                              </p>
                              <p className="truncate text-sm text-secondary-text">
                                {candidate.genre} · {[candidate.city, candidate.country].filter(Boolean).join(', ') || '—'}
                              </p>
                            </div>
                            {/* Sans localisation, « Ajouter à la carte » est
                                désactivé : seul le référencement est possible
                                (l'admin validera une ville avant le pin). */}
                            <button
                              type="button"
                              onClick={() => void addToMap(candidate)}
                              disabled={addingId === candidate.id || !candidate.city}
                              title={candidate.city ? undefined : t('discovery.referHint')}
                              className="flex shrink-0 items-center gap-1.5 rounded-full bg-brand-deep px-4 py-2 text-sm font-bold text-brand-deep-foreground transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
                            >
                              {addingId === candidate.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Plus className="h-4 w-4" />
                              )}
                              {t('discovery.add')}
                            </button>
                          </div>
                          {candidate.bio && (
                            <p className="mt-2 line-clamp-2 text-sm text-secondary-text">
                              {candidate.bio}
                            </p>
                          )}
                          {(Object.keys(candidate.platforms ?? {}).length > 0 ||
                            Object.keys(candidate.socials ?? {}).length > 0) && (
                            <p className="mt-1.5 text-xs text-secondary-text">
                              <span className="font-medium">{t('discovery.by')}</span> · YouTube,
                              Spotify, Apple Music…
                            </p>
                          )}
                          {/* Second chemin : pas de ville → demande de
                              référencement que l'admin validera (le bouton
                              « Ajouter » affiche aussi ce choix via un toast
                              quand le géocodage échoue). */}
                          {!candidate.city && (
                            <button
                              type="button"
                              onClick={() => openRefer(candidate)}
                              className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-hairline-strong px-4 py-2.5 text-sm font-medium text-brand-deep transition-colors hover:bg-brand-soft"
                            >
                              <Send className="h-4 w-4" />
                              {t('discovery.refer')}
                            </button>
                          )}
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

      {/* Formulaire « Demander le référencement » (artiste sans localisation) */}
      {referCandidate && (
        <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center">
          <button
            type="button"
            aria-label="Fermer"
            className="absolute inset-0"
            onClick={closeRefer}
          />
          <div className="relative w-full max-w-lg rounded-t-[2rem] bg-surface p-6 shadow-2xl sm:rounded-[2rem] sm:p-8">
            {referSent ? (
              <div className="flex flex-col items-center gap-4 py-8 text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand text-black">
                  <Send className="h-8 w-8" />
                </span>
                <h3 className="display-font text-2xl font-bold">{t('discovery.referSentTitle')}</h3>
                <p className="text-sm text-secondary-text">{t('discovery.referSentText')}</p>
                <button
                  type="button"
                  onClick={closeRefer}
                  className="mt-2 rounded-full bg-brand-deep px-8 py-3.5 font-bold text-brand-deep-foreground transition-transform hover:scale-105"
                >
                  {t('common.ok')}
                </button>
              </div>
            ) : (
              <>
                <h3 className="display-font text-xl font-bold">{t('discovery.referTitle')}</h3>
                <p className="mt-1.5 text-sm text-secondary-text">
                  {t('discovery.referIntro', { artist: referCandidate.name })}
                </p>

                <div className="mt-5 grid gap-4">
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium">
                      {t('discovery.referArtist')}
                    </span>
                    <input
                      readOnly
                      value={referCandidate.name}
                      className={`${referField} cursor-not-allowed opacity-70`}
                    />
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium">
                        {t('discovery.referCity')} *
                      </span>
                      <input
                        value={referForm.city}
                        onChange={(e) => setReferForm((f) => ({ ...f, city: e.target.value }))}
                        placeholder={t('discovery.referCityPh')}
                        className={referField}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium">
                        {t('discovery.referGenre')}
                      </span>
                      <input
                        value={referForm.genre}
                        onChange={(e) => setReferForm((f) => ({ ...f, genre: e.target.value }))}
                        placeholder="Afro-Soul"
                        className={referField}
                      />
                    </label>
                  </div>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium">
                      {t('discovery.referEmail')} *
                    </span>
                    <input
                      type="email"
                      value={referForm.email}
                      onChange={(e) => setReferForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="vous@email.com"
                      className={referField}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium">
                      {t('discovery.referNote')}
                    </span>
                    <textarea
                      value={referForm.note}
                      onChange={(e) => setReferForm((f) => ({ ...f, note: e.target.value }))}
                      rows={3}
                      placeholder={t('discovery.referNotePh')}
                      className={`${referField} resize-none`}
                    />
                  </label>
                </div>

                {referError && (
                  <p role="alert" className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
                    {referError}
                  </p>
                )}

                <div className="mt-5 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={closeRefer}
                    className="rounded-full border border-hairline-strong px-6 py-3.5 font-medium transition-colors hover:bg-secondary-bg"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={() => void submitRefer()}
                    disabled={referBusy}
                    className="flex flex-1 items-center justify-center gap-2 rounded-full bg-brand-deep py-3.5 font-bold text-brand-deep-foreground transition-transform hover:scale-[1.02] disabled:opacity-60"
                  >
                    {referBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {t('discovery.referSubmit')}
                  </button>
                </div>
                <p className="mt-3 text-center text-xs text-secondary-text">
                  {t('discovery.referAdminNote')}
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Bouton retour */}
      {selected && (
        <button
          type="button"
          onClick={() => {
            setSelected(null)
            // Garde les pins de la zone recherchée : l'utilisateur peut en
            // cliquer d'autres ou revenir à la vue d'ensemble pour les effacer.
            mapRef.current?.flyTo([2.2, 6.4], 4)
          }}
          className="absolute left-4 top-4 z-30 flex items-center gap-2 rounded-full bg-surface/85 px-4 py-2 text-sm font-medium shadow-lg backdrop-blur-xl transition-colors hover:bg-surface"
        >
          <ChevronLeft className="h-4 w-4" /> {t('globe.back')}
        </button>
      )}

      {/* Fiche artiste — un clic dans le vide (hors de la fiche) la ferme */}
      {selected && (
        <>
          <button
            type="button"
            aria-label={t('globe.closeSheet')}
            onClick={() => setSelected(null)}
            className="absolute inset-0 z-20"
          />
          <ArtistSheet
            artist={selected}
            nearby={nearby}
            onClose={() => {
              // Retour à la zone : on redéploie les pins du lieu si un lieu
              // est actif (sinon on garde le pin unique de l'artiste) et on
              // remet le pin de l'artiste en évidence.
              setHighlightedId(selected.id)
              if (selectedPlace) setVisiblePins(selectedPlace.artists)
              setSelected(null)
            }}
            onSelectArtist={goToArtist}
          />
        </>
      )}
    </div>
  )
}
