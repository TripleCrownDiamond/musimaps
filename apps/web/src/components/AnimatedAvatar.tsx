import { memo, useState } from 'react'
import { RuntimeLoader, useRive } from '@rive-app/react-canvas'
import riveWasmUrl from '@rive-app/canvas/rive.wasm?url'
import avatarsRiv from '@/assets/rive/avatars.riv?url'

// Bundle le WASM Rive localement (pas de dépendance CDN en prod).
RuntimeLoader.setWasmUrl(riveWasmUrl)

const ARTBOARDS = ['Avatar 1', 'Avatar 2', 'Avatar 3'] as const

/** Choisit un artboard de façon stable pour un nom donné. */
function pickArtboard(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  }
  return ARTBOARDS[hash % ARTBOARDS.length]
}

function initialsOf(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

interface RiveLayerProps {
  name: string
}

/** Canvas Rive plein conteneur ; ne rend rien si le chargement échoue. */
function RiveLayer({ name }: RiveLayerProps) {
  const [failed, setFailed] = useState(false)
  const artboard = pickArtboard(name)
  const { RiveComponent } = useRive(
    {
      src: avatarsRiv,
      artboard,
      stateMachines: 'avatar',
      autoplay: true,
      onLoadError: () => setFailed(true),
    },
    { useOffscreenRenderer: true, fitCanvasToArtboardHeight: false },
  )
  if (failed) return null
  return <RiveComponent className="absolute inset-0 h-full w-full" />
}

export interface AnimatedAvatarProps {
  name: string
  image?: string | null
  /** Classes du wrapper : taille + arrondi + overflow. */
  className?: string
  /** Classes supplémentaires pour l'image. */
  imageClassName?: string
  /** Classes des initiales (fond gradient, couleur texte). */
  initialsClassName?: string
  alt?: string
}

/**
 * Hiérarchie d'avatar : photo → avatar Rive animé → initiales.
 * Quand une photo existe, aucun moteur Rive n'est monté (léger).
 */
export function AnimatedAvatar({
  name,
  image,
  className = '',
  imageClassName = '',
  initialsClassName = '',
  alt,
}: AnimatedAvatarProps) {
  const initials = initialsOf(name)
  return (
    <div className={`relative shrink-0 overflow-hidden ${className}`}>
      {image ? (
        <img
          src={image}
          alt={alt ?? name}
          className={`h-full w-full object-cover ${imageClassName}`}
        />
      ) : (
        <>
          <span
            aria-hidden="true"
            className={`flex h-full w-full items-center justify-center ${initialsClassName}`}
          >
            {initials}
          </span>
          <RiveLayer name={name} />
        </>
      )}
    </div>
  )
}

export default memo(AnimatedAvatar)
