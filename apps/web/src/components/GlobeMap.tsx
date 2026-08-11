import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import type { Artist } from '@musimaps/shared'
import {
  bucketKey,
  CAMERA,
  clusterBy,
  compactCount,
  countryByCode,
  declump,
  firstRenderedPosition,
  flagFor,
  geoCountryOf,
  hexToRgba,
  isValidCoordinate,
  levelFor,
  MAX_ZOOM,
  parseFollowersCount,
  pinGlowFor,
  pinOpacityFor,
  pinZoomScale,
  POPULARITY_RING_COLORS,
  renderedPosition,
  spinDeltaFor,
  planStyleActions,
  DETAIL_LINES_ZOOM,
  FOG,
  MAP_STYLE,
  type MapTheme,
  tierOf,
  TIER_SIZE_FACTOR,
  type ClusterLevel,
  type PopularityMap,
  type PopularityTier,
} from '@musimaps/shared'
import { GLOBE_VIEW, MAPBOX_TOKEN } from '../lib/mapbox'

/** Artistes supplémentaires (découverts sur le web) à ajouter au globe. */
const EMPTY: Artist[] = []

export interface GlobeMapHandle {
  /** Fait tourner le globe vers des coordonnees puis zoome. */
  flyTo: (coordinates: [number, number], zoom?: number) => void
  /**
   * Vole vers la position AFFICHÉE d'un artiste (dés-empilement inclus) :
   * au zoom rapproché, la spirale peut décaler le pin de plusieurs centaines
   * de px du point brut — voler sur le point brut le laisserait dans un coin.
   */
  focusArtist: (id: string) => void
  /**
   * Vole vers le PREMIER artiste valide de la liste (position dés-empilée) :
   * un clic sur cluster ou une recherche de lieu ne doit jamais atterrir dans
   * le vide du barycentre — toujours sur un pin visible.
   */
  focusFirst: (artists: Artist[], zoom?: number) => void
  /** Revient a la vue globe complete. */
  resetView: () => void
}

/** Zoom cible de `focusArtist` (niveau quartier, pins individuels). */

/**
 * Score de popularité réel (vues profil + pin + abonnés parsés). Fourni par
 * le parent (bulk `artist_stats`) sous forme de Map id → score ; les artistes
 * absents retombent sur les followers parsés de l'objet.
 */


interface GlobeMapProps {
  /** Recoit l'API imperative une fois la carte prete. */
  onReady?: (handle: GlobeMapHandle) => void
  onSelectArtist?: (artist: Artist) => void
  /**
   * Clic sur un cluster (pays/ville/sous-groupe) : le parent scope les pins
   * aux artistes du cluster (comme une recherche) avant de voler dessus, pour
   * ne jamais montrer des pins de pays voisins au bord du viewport.
   * `place` n'est fourni que pour les clusters de LIEU (pays ou ville) — il
   * alimente le panneau « stats du lieu + nav artiste-à-artiste ».
   */
  onClusterFocus?: (artists: Artist[], place?: ClusterPlace) => void
  /** false : globe decoratif, aucune interaction possible. */
  interactive?: boolean
  /** Rotation automatique. Pilote par le parent, coupee des que l'utilisateur agit. */
  autoRotate?: boolean
  /** Notifie le parent quand l'utilisateur interrompt la rotation en manipulant le globe. */
  onAutoRotateChange?: (value: boolean) => void
  /** Notifie le parent du niveau de zoom (pour replier la recherche en icône). */
  onZoomChange?: (zoom: number) => void
  /** Fond spatial : `dark` pour un globe pose sur une section noire. */
  theme?: MapTheme
  showPins?: boolean
  /**
   * Artistes dont les pins doivent etre rendus. Quand ce tableau est fourni
   * (meme vide), SEULS ces pins sont affiches : la carte reste epuree tant
   * qu'une recherche n'a pas cible une zone ou un artiste.
   */
  visibleArtists?: Artist[]
  /** Artistes découverts (map_artists) affichés en plus du catalogue. */
  extraArtists?: Artist[]
  /**
   * Clustering par zoom (Monde → Pays → Ville → Artistes) : au niveau globe,
   * les artistes sont regroupés par pays puis par ville avec un compteur ;
   * les pins individuels n'apparaissent qu'en zoom rapproché. Désactivé dès
   * que `visibleArtists` est fourni (recherche ciblée).
   */
  cluster?: boolean
  /** Score de popularité par artiste (id → vues + likes). */
  popularityById?: PopularityMap
  /**
   * Artiste dont le pin doit être mis en évidence (nav flèches de la
   * mini-barre « lieu ») : le pin grossit, son anneau devient lime et son
   * nom est affiché en permanence (comme un survol forcé).
   */
  highlightedArtistId?: string | null
  className?: string
}

/**
 * Couleurs du pin par notoriété : fond, halo et encre.
 *
 * La géométrie (spirale de dés-empilement, seuils de cluster, échelles) vit
 * désormais dans `@musimaps/shared/map` — elle était copiée-collée à
 * l'identique dans ExploreScreen.tsx côté mobile.
 */
function pinTierVars(tier: PopularityTier, zoom: number) {
  const color = POPULARITY_RING_COLORS[tier]
  // Le lime (tier 3) demande une encre sombre ; les autres, du blanc.
  const ink = tier === 3 ? '#0b1420' : '#ffffff'
  return { bg: color, glow: hexToRgba(color, pinGlowFor(zoom, tier)), ink }
}

export interface ClusterPlace {
  kind: 'country' | 'city'
  name: string
  code: string
  flag: string
}

export default function GlobeMap({
  onReady,
  onSelectArtist,
  onClusterFocus,
  interactive = true,
  autoRotate = false,
  onAutoRotateChange,
  onZoomChange,
  theme = 'light',
  showPins = false,
  visibleArtists,
  extraArtists = EMPTY,
  cluster = false,
  popularityById,
  highlightedArtistId,
  className = '',
}: GlobeMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<mapboxgl.Marker[]>([])    // Les callbacks passent par des refs : la carte n'est construite qu'une fois.
  // Artistes actuellement affichés (pour focusArtist : recalcul du déclump).
  const artistsRef = useRef<Artist[]>([])
  const popularityRef = useRef(popularityById)
  popularityRef.current = popularityById
  const onSelectRef = useRef(onSelectArtist)
  const onReadyRef = useRef(onReady)
  const onRotateChangeRef = useRef(onAutoRotateChange)
  const onZoomChangeRef = useRef(onZoomChange)
  const onClusterFocusRef = useRef(onClusterFocus)
  onSelectRef.current = onSelectArtist
  onReadyRef.current = onReady
  onRotateChangeRef.current = onAutoRotateChange
  onZoomChangeRef.current = onZoomChange
  onClusterFocusRef.current = onClusterFocus
  const highlightedRef = useRef(highlightedArtistId)
  highlightedRef.current = highlightedArtistId

  // La rotation passe par une ref : basculer le bouton ne doit pas reconstruire la carte.
  const spinRef = useRef(autoRotate)
  useEffect(() => {
    spinRef.current = autoRotate
  }, [autoRotate])

  // La carte n'est construite qu'une fois ; deux états de préparation :
  // - styleReady : le style est chargé (fog + épuration appliqués).
  // - mapLoaded : la carte a fini son premier rendu (les markers posés avant
  //   `load` peuvent se retrouver décalés — en haut à gauche — pendant la
  //   rotation automatique ou le chargement des tuiles).
  const [styleReady, setStyleReady] = useState(false)
  const [mapLoaded, setMapLoaded] = useState(false)
  /**
   * Niveau de cluster DISCRET dérivé du zoom. On ne met à jour l'état que
   * quand le seuil est franchi (pays → ville → sous-groupe → artistes),
   * jamais à chaque frame : la rotation auto (jumpTo) émet moveend en
   * continu, et un état « zoom » brut reconstruirait tous les markers 60 fois
   * par seconde.
   *   - country : clusters par pays (vue monde).
   *   - city    : clusters par ville (pays en vue).
   *   - sub     : sous-groupes ~2 km — les artistes géocodés au même point
   *               (ville-centre) se chevaucheraient → une pin compacte ×N.
   *   - spread  : pins individuels, décalés en spirale pour ne pas s'empiler.
   */  const [clusterLevel, setClusterLevel] = useState<ClusterLevel>('country')
  // Zoom vivant : mis à jour à chaque `zoom` (pas seulement aux seuils de
  // cluster). Sert à rouvrir la spirale de dés-empilement quand on zoome
  // profondément (quartier/rue) — sinon les pins resteraient figés au
  // niveau où le niveau « spread » a été atteint.
  const [liveZoom, setLiveZoom] = useState(0)

  useEffect(() => {
    if (!containerRef.current || !MAPBOX_TOKEN) return

    mapboxgl.accessToken = MAPBOX_TOKEN
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: MAP_STYLE[theme],
      center: GLOBE_VIEW.center,
      zoom: GLOBE_VIEW.zoom,
      // Zoom profond autorisé (niveau rue/quartier) : les tuiles vectorielles
      // restent nettes jusqu'à 18+, et les pins individuels se détachent au
      // fur et à mesure qu'on s'approche (spirale qui s'ouvre avec le zoom).
      maxZoom: MAX_ZOOM,
      projection: 'globe',
      interactive,
      attributionControl: false,
    })
    mapRef.current = map

    map.on('style.load', () => {
      map.setFog({ ...FOG[theme] })
      // Charte de la carte : quelles couches garder, lesquelles masquer, et
      // la couleur des frontières — la recette vit dans
      // `@musimaps/shared/map/style`, appliquée à l'identique par le mobile.
      // La couleur du trait dérive du token de marque, elle n'est plus
      // recopiée en rgba dans chaque plateforme.
      const zoomLines: string[] = []
      for (const action of planStyleActions(map.getStyle().layers ?? [], theme)) {
        if (action.kind === 'paint') {
          map.setPaintProperty(action.id, action.property, action.value)
          continue
        }
        map.setLayoutProperty(action.id, 'visibility', 'none')
        // Les lignes de détail (routes…) reviennent au zoom rue ; les labels
        // secondaires restent masqués.
        if (action.detail) zoomLines.push(action.id)
      }
      const applyZoomLines = () => {
        const show = map.getZoom() >= DETAIL_LINES_ZOOM
        for (const id of zoomLines) {
          map.setLayoutProperty(id, 'visibility', show ? 'visible' : 'none')
        }
      }
      map.on('zoom', applyZoomLines)
      applyZoomLines()
      setStyleReady(true)
    })

    // Rotation automatique — démarrée SEULEMENT après le chargement de la
    // carte. Deux pièges évités :
    //  1. setCenter en boucle pendant le chargement des tuiles désynchronise
    //     les markers (ils se retrouvent projetés en haut à gauche).
    //  2. setCenter (mouvement « animé ») maintient la carte en mouvement en
    //     continu : Mapbox cache alors les markers (opacity: 0) jusqu'au
    //     moveend, qui n'arrive jamais → pins invisibles. jumpTo est
    //     instantané : les markers restent visibles et suivent le globe.
    let frame = 0
    const startSpin = () => {
      cancelAnimationFrame(frame)
      // Rotation exprimée en degrés par SECONDE (valeur partagée avec le
      // mobile) et non par frame : la vitesse ne dépend plus de la cadence
      // de rafraîchissement, et les deux plateformes tournent à l'identique.
      let last = performance.now()
      const spin = (now: number) => {
        const elapsed = now - last
        last = now
        if (spinRef.current) {
          const center = map.getCenter()
          center.lng -= spinDeltaFor(elapsed)
          map.jumpTo({ center })
        }
        frame = requestAnimationFrame(spin)
      }
      frame = requestAnimationFrame(spin)
    }
    const stopSpin = () => {
      if (!spinRef.current) return
      spinRef.current = false
      onRotateChangeRef.current?.(false)
    }
    if (interactive) {
      map.on('mousedown', stopSpin)
      map.on('touchstart', stopSpin)
      map.on('wheel', stopSpin)
    }

    // Épuration au zoom : en vue globe, les pins sont minuscules et discrets ;
    // en zoomant, ils grossissent pour devenir le centre d'attention.
    const applyZoomClass = () => {
      const z = map.getZoom()
      const el = map.getContainer()
      el.classList.toggle('map-zoom-far', z < 3.5)
      el.classList.toggle('map-zoom-near', z >= 5)
      // Pins individuels : petits de loin (épurés), ils grossissent à
      // l'approche. Cette échelle est commune à tous les pins ; le facteur
      // de NOTORIÉTÉ est posé pin par pin (`--pin-tier-size`) et multiplié
      // en CSS — deux artistes au même endroit n'ont plus le même diamètre.
      el.style.setProperty('--pin-scale', pinZoomScale(z).toFixed(3))
      el.style.setProperty('--pin-opacity', pinOpacityFor(z).toFixed(3))
    }
    map.on('zoom', applyZoomClass)
    applyZoomClass()

    const handle: GlobeMapHandle = {
      flyTo: (coordinates, zoom = CAMERA.country.zoom, duration = CAMERA.city.duration) => {
        spinRef.current = false
        onRotateChangeRef.current?.(false)
        map.flyTo({ center: coordinates, zoom, duration, essential: true, curve: 1.6 })
      },
      focusArtist: (id) => {
        // Vole vers la position AFFICHÉE du pin, dés-empilement recalculé au
        // zoom cible : le point brut peut être à des centaines de px du pin.
        const rendered = renderedPosition(artistsRef.current, id, CAMERA.artist.zoom)
        if (!rendered) return
        spinRef.current = false
        onRotateChangeRef.current?.(false)
        map.flyTo({
          center: rendered,
          zoom: CAMERA.artist.zoom,
          duration: CAMERA.artist.duration,
          essential: true,
          curve: 1.4,
        })
      },
      focusFirst: (artists, zoom = CAMERA.artist.zoom) => {
        const first = firstRenderedPosition(artists, zoom)
        if (!first) return
        spinRef.current = false
        onRotateChangeRef.current?.(false)
        map.flyTo({
          center: first.coordinates,
          zoom,
          duration: CAMERA.artist.duration,
          essential: true,
          curve: 1.4,
        })
      },
      resetView: () => {
        // Stoppe la rotation avant le vol : le jumpTo continu du spin
        // annule le flyTo (et on resterait au niveau ville au lieu de
        // revenir au niveau pays/monde).
        spinRef.current = false
        onRotateChangeRef.current?.(false)
        map.flyTo({ ...GLOBE_VIEW, duration: CAMERA.globe.duration, essential: true })
      },
    }
    map.once('load', () => {
      setMapLoaded(true)
      setClusterLevel(levelFor(map.getZoom()))
      onZoomChangeRef.current?.(map.getZoom())
      onReadyRef.current?.(handle)
      // La carte est stable : on peut enfin faire tourner le globe.
      if (spinRef.current) startSpin()
    })
    // On ne rebondit que sur les CHANGEMENTS de niveau (pas chaque frame).
    const onLevelChange = () => {
      const z = map.getZoom()
      onZoomChangeRef.current?.(z)
      setClusterLevel((prev) => {
        const next = levelFor(z)
        return next === prev ? prev : next
      })
    }
    // Pendant un vol (flyTo), le zoom évolue en continu : mettre à jour le
    // niveau de cluster sur l'événement `zoom` (au lieu d'attendre moveend)
    // fait se scinder les clusters progressivement — pays → villes → groupes
    // → pins — avec l'animation de la caméra. Un seul clic suffit.
    const onZoomTick = () => {
      const z = map.getZoom()
      setClusterLevel((prev) => {
        const next = levelFor(z)
        return next === prev ? prev : next
      })
    }
    map.on('zoom', onZoomTick)
    map.on('zoomend', onLevelChange)
    map.on('moveend', onLevelChange)
    // Zoom vivant (toutes les frames du zoom) pour la spirale qui s'ouvre.
    map.on('zoom', () => setLiveZoom(map.getZoom()))

    return () => {
      cancelAnimationFrame(frame)
      map.off('zoom', onZoomTick)
      map.off('moveend', onLevelChange)
      map.off('zoomend', onLevelChange)
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []
      map.remove()
      mapRef.current = null
      setStyleReady(false)
      setMapLoaded(false)
    }
    // autoRotate est volontairement absent : il est lu via spinRef.
  }, [interactive, theme])

  // Pins : rendu indépendant de la construction de la carte. Uniquement après
  // `load` (mapLoaded) pour éviter les markers décalés, et uniquement pour des
  // coordonnées valides. Si `cluster` est actif, les artistes sont regroupés
  // par pays puis par ville selon le zoom.
  useEffect(() => {
    const map = mapRef.current
    if (!styleReady || !mapLoaded || !map) return

    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    const allArtists =
      visibleArtists !== undefined
        ? visibleArtists
        : showPins
          ? extraArtists
          : []
    artistsRef.current = allArtists

    // Wrapper neutre : Mapbox pose son transform (positionnement) dessus.
    // Le scale visuel (taille selon le zoom) est appliqué sur un enfant
    // (`.artist-pin`) pour ne jamais mélanger scale et transform sur le même
    // élément — sinon les pins sont compressés vers le coin haut-gauche.
    const pinWrapper = (): HTMLDivElement => {
      const wrapper = document.createElement('div')
      wrapper.className = 'artist-pin__wrapper'
      return wrapper
    }

    // Un « pin » de cluster (pays, ville ou sous-groupe) : drapeau + compteur.
    const addClusterPin = (
      label: string,
      flag: string,
      count: number,
      coordinates: [number, number],
      zoomTo: number,
      variant?: 'sub',
      /** Artistes du cluster — le clic les scope (pas de pins de voisins). */
      members?: Artist[],
      place?: ClusterPlace,
    ) => {
      const wrapper = pinWrapper()
      const el = document.createElement('button')
      el.type = 'button'
      el.className =
        'artist-pin artist-pin--cluster' + (variant === 'sub' ? ' artist-pin--sub' : '')
      el.setAttribute('aria-label', `${label} — ${count} artistes`)
      // Stats du cluster : compteur d'artistes + popularité agrégée (fans
      // externes des membres, notation compacte « 10 K » / « 1,2 M »).
      const totalFans = (members ?? []).reduce(
        (s, a) => s + (parseFollowersCount(a.followers) || 0),
        0,
      )
      const content = document.createElement('span')
      content.className = 'artist-pin__cluster-content'
      const main = document.createElement('span')
      main.className = 'artist-pin__cluster-main'
      // Pays : drapeau + code ISO lisible (« 🇳🇬 NG ») ; sous-cluster : compte.
      main.textContent = variant === 'sub' ? `${count}` : `${flag} ${label} · ${count}`
      content.appendChild(main)
      if (totalFans > 0) {
        const stats = document.createElement('span')
        stats.className = 'artist-pin__cluster-stats'
        stats.textContent = `${compactCount(totalFans)} fans`
        content.appendChild(stats)
      }
      el.appendChild(content)
      // Pin de cluster lumineux : couleur par DENSITÉ (tier le plus élevé de
      // ses membres) — fond + halo, comme les pins individuels.
      if (members && members.length > 0) {
        const tier = Math.max(
          ...members.map((a) => tierOf(a, popularityRef.current)),
        ) as PopularityTier
        const tierVars = pinTierVars(tier, liveZoom)
        el.style.setProperty('--pin-tier-color', tierVars.bg)
        el.style.setProperty('--pin-tier-glow', tierVars.glow)
        el.style.setProperty('--pin-ink', tierVars.ink)
      }
      wrapper.appendChild(el)
      const onClick = () => {
        spinRef.current = false
        onRotateChangeRef.current?.(false)
        // Scope les pins aux artistes du cluster (comme une recherche) :
        // seuls ces pins s'affichent — pas les voisins au bord du viewport.
        if (members && members.length > 0) {
          onClusterFocusRef.current?.(members, place)
        }
        // Vole vers le PREMIER artiste du cluster (position dés-empilée) :
        // au lieu du barycentre (souvent dans le vide), on atterrit toujours
        // sur un pin visible, mis en évidence (highlightedId dans le parent).
        let targetCoords = coordinates
        let targetZoom = zoomTo
        if (members && members.length > 0) {
          const firstMember = members[0]
          if (firstMember && isValidCoordinate(firstMember.coordinates)) {
            const spread = declump(members, CAMERA.artist.zoom)
            const rendered = spread.get(firstMember.id)
            if (rendered) {
              targetCoords = rendered
              targetZoom = CAMERA.artist.zoom
            }
          }
        }
        map.flyTo({ center: targetCoords, zoom: targetZoom, duration: 1600, essential: true })
      }
      if (interactive) {
        el.addEventListener('click', (e) => {
          e.stopPropagation()
          onClick()
        })
      } else {
        el.style.pointerEvents = 'none'
      }
      markersRef.current.push(
        new mapboxgl.Marker({ element: wrapper }).setLngLat(coordinates).addTo(map),
      )
    }

    // Un « pin » d'artiste individuel (initiales ou photo, cliquable).
    const addArtistPin = (artist: Artist, coords: [number, number]) => {
      const wrapper = pinWrapper()
      const el = document.createElement('button')
      el.type = 'button'
      el.className = 'artist-pin'
      el.setAttribute('aria-label', `${artist.name} — ${artist.city}`)
      // Pin lumineux : couleur ET TAILLE selon la notoriété. Le facteur de
      // taille est propre au pin (`--pin-tier-size`) et se multiplie à
      // l'échelle de zoom commune — un artiste très suivi est un point plus
      // large et plus rayonnant qu'un artiste discret, au même endroit.
      const tier = tierOf(artist, popularityRef.current)
      const tierVars = pinTierVars(tier, liveZoom)
      el.style.setProperty('--pin-tier-color', tierVars.bg)
      el.style.setProperty('--pin-tier-glow', tierVars.glow)
      el.style.setProperty('--pin-ink', tierVars.ink)
      el.style.setProperty('--pin-tier-size', String(TIER_SIZE_FACTOR[tier]))
      const tip = document.createElement('span')
      tip.className = 'artist-pin__tooltip'
      tip.textContent = artist.name
      wrapper.appendChild(tip)
      // Pin « sélectionné » (nav flèches de la mini-barre « lieu ») :
      // grossi, anneau lime et nom affiché en permanence.
      if (artist.id === highlightedRef.current) {
        el.classList.add('artist-pin--selected')
        tip.classList.add('artist-pin__tooltip--visible')
      }
      const initials = artist.name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
      if (artist.image) {
        el.classList.add('artist-pin--img')
        const img = document.createElement('img')
        img.src = artist.image
        img.alt = ''
        img.draggable = false
        img.onerror = () => {
          img.remove()
          el.classList.remove('artist-pin--img')
          el.textContent = initials
        }
        el.appendChild(img)
      } else {
        el.textContent = initials
      }
      if ((artist.events?.length ?? 0) > 0) {
        el.classList.add('artist-pin--event')
        const ring = document.createElement('span')
        ring.className = 'artist-pin__ring'
        el.appendChild(ring)
      }
      if (interactive && onSelectRef.current) {
        el.addEventListener('click', (e) => {
          e.stopPropagation()
          onSelectRef.current?.(artist)
        })
      } else {
        el.style.pointerEvents = 'none'
      }
      wrapper.appendChild(el)
      markersRef.current.push(
        new mapboxgl.Marker({ element: wrapper }).setLngLat(coords).addTo(map),
      )
    }

    // Clustering (Monde → pays → villes → artistes) : appliqué à l'ensemble
    // affiché — qu'il s'agisse de tout le catalogue ou du résultat ciblé d'une
    // recherche (ville/pays/genre). En se dézoomant, les pins individuels
    // redeviennent des clusters pays/villes lisibles au lieu de disparaître.
    if (cluster && allArtists.length > 0) {
      // Monde → pays (drapeau + compteur) ; on ne voit pas les noms d'artistes.
      if (clusterLevel === 'country') {
        // Clustering GÉOGRAPHIQUE : on regroupe par le pays où l'artiste est
        // réellement (ville connue → pays), pas par son pays d'origine. Un
        // cap-verdien installé à Dakar compte dans le cluster 🇸🇳 — sinon le
        // pin « CV » ou « US » flotterait au-dessus de l'Afrique (barycentre
        // des coordonnées) alors que ses artistes vivent à Accra/Dakar.
        const located = allArtists.filter(
          (a) => (a.city ?? '').trim() || (a.country ?? '').trim(),
        )
        const byGeo = new Map<string, { code: string; flag: string }>()
        const clusterKey = (a: Artist) => {
          const code = geoCountryOf(a.city, a.country)
          if (!byGeo.has(code)) {
            byGeo.set(code, { code, flag: flagFor(code) })
          }
          return code
        }
        for (const c of clusterBy(located, clusterKey)) {
          const geo = byGeo.get(c.key) ?? { code: c.key, flag: c.flag }
          // 12 = niveau quartier (z≥9 = pins individuels) : le clic sur un
          // pays dévoile directement les artistes ET s'approche assez pour
          // que les pins d'une même ville se détachent. Pendant le vol, le
          // niveau de cluster se met à jour en continu (zoom tick) : les
          // clusters se scindent progressivement pays → villes → groupes →
          // pins. Le clic scope aussi les pins aux artistes de ce pays.
          const members = located.filter((a) => clusterKey(a) === c.key)
          const countryName =
            countryByCode(geo.code)?.fr ?? countryByCode(geo.code)?.en ?? geo.code
          addClusterPin(
            geo.code,
            geo.flag,
            c.count,
            c.coordinates,
            CAMERA.country.zoom,
            undefined,
            members,
            {
              kind: 'country',
              code: geo.code,
              name: countryName,
              flag: geo.flag,
            },
          )
        }
        return
      }
      // Pays → villes (nom + compteur). La clé interne reste « ville|pays »
      // (deux villes homonymes restent séparées) mais le libellé affiché et
      // l'aria-label n'affichent que le nom de la ville.
      if (clusterLevel === 'city') {
        // Même logique GÉOGRAPHIQUE qu'au niveau pays : une ville est une
        // seule pin, avec le drapeau du pays où elle se trouve réellement —
        // pas un pin par pays d'origine (sinon Dakar éclate en 5 pins 🇸🇳/
        // 🇨🇦/🇨🇻/🇫🇷/🇬🇳 pour la diaspora). Deux villes homonymes restent
        // séparées en gardant le pays géo dans la clé interne.
        const located = allArtists.filter(
          (a) => (a.country ?? '').trim() && (a.city ?? '').trim(),
        )
        const flagByCity = new Map<string, string>()
        const cityKey = (a: Artist) => {
          const code = geoCountryOf(a.city, a.country)
          if (!flagByCity.has(code)) flagByCity.set(code, flagFor(code))
          return `${a.city}|${code}`
        }
        for (const c of clusterBy(located, cityKey)) {
          const code = c.key.split('|')[1] ?? ''
          const members = located.filter((a) => cityKey(a) === c.key)
          addClusterPin(
            c.label.split('|')[0],
            flagByCity.get(code) ?? c.flag,
            c.count,
            c.coordinates,
            CAMERA.city.zoom,
            undefined,
            members,
            {
              kind: 'city',
              code,
              name: c.label.split('|')[0],
              flag: flagByCity.get(code) ?? c.flag,
            },
          )
        }
        return
      }
      // Zoom intermédiaire : sous-groupes ~2 km. Les artistes géocodés au
      // même point de ville (fréquent : tout le monde « vit » au centre)
      // seraient parfaitement empilés à ce zoom → une pin compacte ×N,
      // cliquable pour zoomer jusqu'aux pins individuels décalés.
      if (clusterLevel === 'sub') {
        const groups = new Map<string, Artist[]>()
        for (const artist of allArtists) {
          if (!isValidCoordinate(artist.coordinates)) continue
          const key = bucketKey(artist.coordinates)
          const group = groups.get(key)
          if (group) group.push(artist)
          else groups.set(key, [artist])
        }
        for (const group of groups.values()) {
          group.sort((a, b) => a.name.localeCompare(b.name))
          // Un seul artiste dans la « case » : son pin individuel suffit — pas
          // de pilule « ×1 » parasite.
          if (group.length === 1) {
            addArtistPin(group[0], group[0].coordinates)
            continue
          }
          const cLng = group.reduce((s, a) => s + a.coordinates[0], 0) / group.length
          const cLat = group.reduce((s, a) => s + a.coordinates[1], 0) / group.length
          addClusterPin(
            group[0].name,
            group[0].flag,
            group.length,
            [cLng, cLat],
            CAMERA.sub.zoom,
            'sub',
            group,
          )
        }
        return
      }
      // Zoom rapproché : pins individuels, dés-empilés en spirale.
    }

    // Coordonnées d'affichage : spirale déterministe quand plusieurs artistes
    // partagent la même localisation (≈2 km) — chaque pin reste cliquable et
    // visible au lieu d'être écrasé sous les autres. La spirale s'ouvre avec
    // le zoom courant (quartier/rue) pour des pins détachés.
    const spread = declump(allArtists, liveZoom)
    const seenIds = new Set<string>()
    for (const artist of allArtists) {
      if (seenIds.has(artist.id)) continue
      seenIds.add(artist.id)
      // Aucun marker si les coordonnées sont invalides (bug « pin en haut à
      // gauche ») : on ne crée pas de marker sans position géographique sûre.
      if (!isValidCoordinate(artist.coordinates)) continue
      addArtistPin(artist, spread.get(artist.id) ?? artist.coordinates)
    }
  }, [styleReady, mapLoaded, interactive, showPins, visibleArtists, extraArtists, cluster, clusterLevel, popularityById, liveZoom, highlightedArtistId])

  // Le conteneur Mapbox est un div interne : mapbox-gl.css force `position: relative`
  // sur .mapboxgl-map et ecraserait un `absolute inset-0` passe via className.
  return (
    <div className={className}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}
