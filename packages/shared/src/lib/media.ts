/**
 * URL d'image d'artiste utilisable par les deux surfaces.
 *
 * Les originales Wikimedia sont parfois très lourdes ou refusées par le
 * chargeur natif. Leur miniature publique est stable, plus légère et garde
 * une résolution suffisante pour un avatar de pin.
 */
export function normalizeArtistImageUrl(raw: string | null | undefined): string {
  const value = raw?.trim();
  if (!value) return '';

  const https = value.startsWith('//')
    ? `https:${value}`
    : value.replace(/^http:\/\//i, 'https://');
  const match = https.match(
    /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/(?!thumb\/)(.+\/)([^/?#]+)$/i,
  );
  if (!match) return https;

  const [, path, filename] = match;
  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${path}${filename}/320px-${filename}`;
}
