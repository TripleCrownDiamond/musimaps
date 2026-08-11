import { Image } from 'react-native';
import { useAppTheme } from '../context/ThemeContext';

/**
 * Marque Musimaps (icône à deux formes, sans wordmark) — le logo utilisé par
 * la topbar (AppBar), le globe et l'onboarding : blanche en thème sombre,
 * bleu foncé en clair, comme l'icône de l'app.
 */
export function BrandMark({ size = 40 }: { size?: number }) {
  const { theme } = useAppTheme();
  const source =
    theme === 'dark'
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
