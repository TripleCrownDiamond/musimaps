import { useThemeValue } from '../lib/theme'
import logoBlack from '../assets/brand/logo-black.png'
import logoWhite from '../assets/brand/logo-white.png'

interface BrandProps {
  /** Classes supplémentaires (taille…). Ex. « h-12 w-auto ». */
  className?: string
}

/**
 * Logo officiel Musimaps (image) adapté au thème :
 * noir « forme 2 » en clair, blanc en sombre — contraste avec le fond.
 * Utilisé sur le site et dans l'admin pour une seule identité visuelle.
 */
export default function Brand({ className = '' }: BrandProps) {
  const theme = useThemeValue()
  return (
    <img
      src={theme === 'dark' ? logoWhite : logoBlack}
      alt="Musimaps"
      className={`h-9 w-auto ${className}`}
    />
  )
}
