import { Image } from 'react-native';
import { useAppTheme } from '../context/ThemeContext';

/**
 * Marque Musimaps (icône à deux formes, sans wordmark) — le logo utilisé par
 * la topbar (AppBar), le globe et l'onboarding : blanche en thème sombre,
 * bleu foncé en clair, comme l'icône de l'app.
 *
 * `tone` décrit la version du LOGO : `'light'` force la version blanche
 * (utile quand la topbar flotte au-dessus d'une cover sombre, où la version
 * bleu foncé deviendrait illisible), `'dark'` force la version bleu foncé,
 * `'auto'` suit le thème (blanc en thème sombre, bleu foncé en clair).
 */
export function BrandMark({ size = 40, tone = 'auto' }: { size?: number; tone?: 'auto' | 'light' | 'dark' }) {
  const { theme } = useAppTheme();
  const resolved =
    tone === 'auto' ? (theme === 'dark' ? 'light' : 'dark') : tone;
  const source =
    resolved === 'light'
      ? require('../../assets/brand/icon-white.png')
      : require('../../assets/brand/icon.png');
  return (
    <Image
      accessibilityLabel="Musimaps"
      resizeMode="contain"
      source={source}
      style={{ width: size, height: size }}
    />
  );
}
