/**
 * URL d'image d'artiste utilisable par les deux surfaces.
 *
 * Les originales Wikimedia sont parfois très lourdes ou refusées par le
 * chargeur natif (Android peut renvoyer 403). Le proxy d'image public fournit
 * une miniature stable, plus légère et garde une résolution suffisante pour
 * un avatar de pin.
 */
const ARTIST_IMAGE_PROXY_WIDTH = 500;

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

  return `https://images.weserv.nl/?url=${encodeURIComponent(https)}&w=${ARTIST_IMAGE_PROXY_WIDTH}`;
}
