import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { artists, type Artist } from '../data/artists'
import { GLOBE_VIEW, MAPBOX_TOKEN, MAP_STYLE } from '../lib/mapbox'

export interface GlobeMapHandle {
  /** Fait tourner le globe vers des coordonnees puis zoome. */
  flyTo: (coordinates: [number, number], zoom?: number) => void
  /** Revient a la vue globe complete. */
  resetView: () => void
}

/** Halo atmospherique : clair sur fond clair, spatial sur fond noir. */
const FOG = {
  light: {
    color: 'rgb(220, 245, 250)',
    'high-color': 'rgb(150, 225, 235)',
    'horizon-blend': 0.08,
    'space-color': 'rgb(240, 248, 250)',
    'star-intensity': 0,
  },
  dark: {
    color: 'rgb(10, 14, 18)',
    'high-color': 'rgb(0, 60, 70)',
    'horizon-blend': 0.06,
    'space-color': 'rgb(0, 0, 0)',
    'star-intensity': 0.15,
  },
} as const

interface GlobeMapProps {
  /** Recoit l'API imperative une fois la carte prete. */
  onReady?: (handle: GlobeMapHandle) => void
  onSelectArtist?: (artist: Artist) => void
  /** false : globe decoratif, aucune interaction possible. */
  interactive?: boolean
  /** Rotation automatique. Pilote par le parent, coupee des que l'utilisateur agit. */
  autoRotate?: boolean
  /** Notifie le parent quand l'utilisateur interrompt la rotation en manipulant le globe. */
  onAutoRotateChange?: (value: boolean) => void
  /** Fond spatial : `dark` pour un globe pose sur une section noire. */
  theme?: keyof typeof FOG
  showPins?: boolean
  className?: string
}

export default function GlobeMap({
  onReady,
  onSelectArtist,
  interactive = true,
  autoRotate = false,
  onAutoRotateChange,
  theme = 'light',
  showPins = true,
  className = '',
}: GlobeMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  // Les callbacks passent par des refs : la carte n'est construite qu'une fois.
  const onSelectRef = useRef(onSelectArtist)
  const onReadyRef = useRef(onReady)
  const onRotateChangeRef = useRef(onAutoRotateChange)
  onSelectRef.current = onSelectArtist
  onReadyRef.current = onReady
  onRotateChangeRef.current = onAutoRotateChange

  // La rotation passe par une ref : basculer le bouton ne doit pas reconstruire la carte.
  const spinRef = useRef(autoRotate)
  useEffect(() => {
    spinRef.current = autoRotate
  }, [autoRotate])

  useEffect(() => {
    if (!containerRef.current || !MAPBOX_TOKEN) return

    mapboxgl.accessToken = MAPBOX_TOKEN
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: GLOBE_VIEW.center,
      zoom: GLOBE_VIEW.zoom,
      projection: 'globe',
      interactive,
      attributionControl: false,
    })

    map.on('style.load', () => map.setFog({ ...FOG[theme] }))

    // Rotation automatique, interrompue des que l'utilisateur manipule le globe
    let frame = requestAnimationFrame(function spin() {
      if (spinRef.current && !map.isMoving()) {
        const center = map.getCenter()
        center.lng -= 0.08
        map.setCenter(center)
      }
      frame = requestAnimationFrame(spin)
    })
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

    // Pins artistes
    const markers: mapboxgl.Marker[] = []
    if (showPins) {
      for (const artist of artists) {
        const el = document.createElement('button')
        el.type = 'button'
        el.className = 'artist-pin'
        el.setAttribute('aria-label', `${artist.name} — ${artist.city}`)
        el.textContent = artist.name
          .split(' ')
          .map((w) => w[0])
          .join('')
          .slice(0, 2)
          .toUpperCase()
        if (interactive && onSelectRef.current) {
          el.addEventListener('click', (e) => {
            e.stopPropagation()
            onSelectRef.current?.(artist)
          })
        } else {
          el.style.pointerEvents = 'none'
        }
        markers.push(new mapboxgl.Marker({ element: el }).setLngLat(artist.coordinates).addTo(map))
      }
    }

    const handle: GlobeMapHandle = {
      flyTo: (coordinates, zoom = 5) => {
        spinRef.current = false
        onRotateChangeRef.current?.(false)
        map.flyTo({ center: coordinates, zoom, duration: 2600, essential: true, curve: 1.6 })
      },
      resetView: () => {
        map.flyTo({ ...GLOBE_VIEW, duration: 2000, essential: true })
      },
    }
    map.once('load', () => onReadyRef.current?.(handle))

    return () => {
      cancelAnimationFrame(frame)
      markers.forEach((m) => m.remove())
      map.remove()
    }
    // autoRotate est volontairement absent : il est lu via spinRef.
  }, [interactive, showPins, theme])

  // Le conteneur Mapbox est un div interne : mapbox-gl.css force `position: relative`
  // sur .mapboxgl-map et ecraserait un `absolute inset-0` passe via className.
  return (
    <div className={className}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}
