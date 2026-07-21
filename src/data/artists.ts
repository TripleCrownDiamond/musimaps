export interface Track {
  title: string
  duration: string
}

export interface EventDate {
  label: string
  venue: string
  date: string
}

export interface Artist {
  id: string
  name: string
  genre: string
  city: string
  country: string
  flag: string
  /** [longitude, latitude] — ordre attendu par Mapbox */
  coordinates: [number, number]
  bio: string
  followers: string
  trending?: boolean
  verified?: boolean
  tracks: Track[]
  events: EventDate[]
}

export const artists: Artist[] = [
  {
    id: 'aria-lyra',
    name: 'Aria Lyra',
    genre: 'Afro-Soul',
    city: 'Cotonou',
    country: 'Bénin',
    flag: '🇧🇯',
    coordinates: [2.4183, 6.3703],
    bio: "Voix de la nouvelle scène béninoise, Aria Lyra tisse des mélodies soul sur des percussions traditionnelles vodun.",
    followers: '2.4k',
    trending: true,
    verified: true,
    tracks: [
      { title: 'Lagune', duration: '3:42' },
      { title: 'Sable Rouge', duration: '4:15' },
      { title: 'Nuit Fon', duration: '3:08' },
    ],
    events: [
      { label: 'Festival Vodun Days', venue: 'Ouidah', date: '12 janv.' },
      { label: 'Live Session', venue: 'Le Repaire, Cotonou', date: '28 janv.' },
    ],
  },
  {
    id: 'seya',
    name: 'Seya',
    genre: 'Afro-Fusion',
    city: 'Porto-Novo',
    country: 'Bénin',
    flag: '🇧🇯',
    coordinates: [2.6289, 6.4969],
    bio: "Seya mélange guitare surf et rythmes afrobeat. Sa musique capture l'énergie des côtes ouest-africaines.",
    followers: '5.1k',
    verified: true,
    tracks: [
      { title: 'Marée Haute', duration: '3:55' },
      { title: 'Kpanlogo', duration: '4:02' },
    ],
    events: [{ label: 'Release Party', venue: 'Espace Tchif', date: '03 févr.' }],
  },
  {
    id: 'kwame-echo',
    name: 'Kwame Echo',
    genre: 'Highlife Électronique',
    city: 'Accra',
    country: 'Ghana',
    flag: '🇬🇭',
    coordinates: [-0.187, 5.6037],
    bio: 'Producteur ghanéen qui réinvente le highlife des années 70 avec des synthés modulaires.',
    followers: '8.7k',
    trending: true,
    verified: true,
    tracks: [
      { title: 'Osu Nights', duration: '5:20' },
      { title: 'Palm Wine Circuit', duration: '4:44' },
    ],
    events: [{ label: 'Afrochella', venue: 'Accra Sports Stadium', date: '29 déc.' }],
  },
  {
    id: 'ife-sound',
    name: 'Ifé Sound',
    genre: 'Alté',
    city: 'Lagos',
    country: 'Nigeria',
    flag: '🇳🇬',
    coordinates: [3.3792, 6.5244],
    bio: "Collectif lagosien au croisement de l'alté, du R&B et des chants yoruba.",
    followers: '31k',
    trending: true,
    verified: true,
    tracks: [
      { title: 'Mainland', duration: '3:12' },
      { title: 'Owambe', duration: '3:48' },
      { title: 'Third Bridge', duration: '4:30' },
    ],
    events: [{ label: 'Lagos Live', venue: 'Muri Okunola Park', date: '18 janv.' }],
  },
  {
    id: 'nour',
    name: 'Nour',
    genre: 'Gnawa Moderne',
    city: 'Marrakech',
    country: 'Maroc',
    flag: '🇲🇦',
    coordinates: [-7.9811, 31.6295],
    bio: 'Nour prolonge la transe gnawa avec des basses profondes et des textures ambient.',
    followers: '12k',
    verified: true,
    tracks: [
      { title: 'Guembri', duration: '6:10' },
      { title: 'Medina Dub', duration: '5:02' },
    ],
    events: [{ label: 'Nuits Gnaoua', venue: 'Essaouira', date: '21 juin' }],
  },
  {
    id: 'luna-wave',
    name: 'Luna Wave',
    genre: 'Neo-Soul',
    city: 'Lisbonne',
    country: 'Portugal',
    flag: '🇵🇹',
    coordinates: [-9.1393, 38.7223],
    bio: 'Luna Wave chante le fado à travers un prisme neo-soul, entre saudade et groove.',
    followers: '4.7k',
    tracks: [
      { title: 'Alfama', duration: '4:08' },
      { title: 'Tejo', duration: '3:36' },
    ],
    events: [{ label: 'Festival Sol', venue: 'LX Factory', date: '09 mars' }],
  },
  {
    id: 'the-nomad',
    name: 'The Nomad',
    genre: 'Électro-Acoustique',
    city: 'Dakar',
    country: 'Sénégal',
    flag: '🇸🇳',
    coordinates: [-17.4677, 14.7167],
    bio: "Kora et machines : The Nomad construit des paysages sonores entre Sahel et clubs européens.",
    followers: '1.8k',
    tracks: [
      { title: 'Sahel Transit', duration: '5:44' },
      { title: 'Gorée', duration: '4:19' },
    ],
    events: [{ label: 'Dakar Music Expo', venue: 'Institut français', date: '14 févr.' }],
  },
  {
    id: 'echo-chamber',
    name: 'Echo Chamber',
    genre: 'Ambient',
    city: 'Berlin',
    country: 'Allemagne',
    flag: '🇩🇪',
    coordinates: [13.405, 52.52],
    bio: 'Duo berlinois qui enregistre des drones dans des bunkers désaffectés.',
    followers: '3.2k',
    tracks: [
      { title: 'Kreuzberg Drift', duration: '8:02' },
      { title: 'Null', duration: '6:27' },
    ],
    events: [{ label: 'Berlin Atonal', venue: 'Kraftwerk', date: '30 août' }],
  },
  {
    id: 'sol-brava',
    name: 'Sol Brava',
    genre: 'Baile Funk',
    city: 'Rio de Janeiro',
    country: 'Brésil',
    flag: '🇧🇷',
    coordinates: [-43.1729, -22.9068],
    bio: 'Sol Brava fait dialoguer le baile funk carioca et les percussions afro-brésiliennes.',
    followers: '22k',
    trending: true,
    verified: true,
    tracks: [
      { title: 'Favela Sunrise', duration: '2:58' },
      { title: 'Copacabana 4AM', duration: '3:21' },
    ],
    events: [{ label: 'Carnaval Session', venue: 'Lapa', date: '11 févr.' }],
  },
  {
    id: 'kiyomi',
    name: 'Kiyomi',
    genre: 'City Pop Revival',
    city: 'Tokyo',
    country: 'Japon',
    flag: '🇯🇵',
    coordinates: [139.6917, 35.6895],
    bio: 'Kiyomi ressuscite la city pop des années 80 avec une production contemporaine.',
    followers: '17k',
    verified: true,
    tracks: [
      { title: 'Shibuya Rain', duration: '4:12' },
      { title: 'Midnight Line', duration: '3:47' },
    ],
    events: [{ label: 'Blue Note Tokyo', venue: 'Minato', date: '05 avr.' }],
  },
  {
    id: 'mira-fields',
    name: 'Mira Fields',
    genre: 'Indie Folk',
    city: 'Montréal',
    country: 'Canada',
    flag: '🇨🇦',
    coordinates: [-73.5673, 45.5017],
    bio: 'Folk intimiste enregistré dans un chalet des Laurentides, en français et en anglais.',
    followers: '6.3k',
    tracks: [
      { title: 'First Frost', duration: '3:29' },
      { title: 'Rue Saint-Denis', duration: '4:01' },
    ],
    events: [{ label: 'POP Montréal', venue: 'Rialto', date: '25 sept.' }],
  },
  {
    id: 'tala',
    name: 'Tala',
    genre: 'Qawwali Électronique',
    city: 'Lahore',
    country: 'Pakistan',
    flag: '🇵🇰',
    coordinates: [74.3587, 31.5204],
    bio: 'Tala superpose chant qawwali traditionnel et beats downtempo.',
    followers: '9.4k',
    verified: true,
    tracks: [
      { title: 'Shahi Qila', duration: '7:15' },
      { title: 'Ravi', duration: '5:33' },
    ],
    events: [{ label: 'Lahooti Melo', venue: 'Hyderabad', date: '17 févr.' }],
  },
]

export function findArtist(id: string) {
  return artists.find((a) => a.id === id)
}

/** Recherche libre sur le nom, la ville, le pays et le genre. */
export function searchArtists(query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return artists.filter((a) =>
    [a.name, a.city, a.country, a.genre].some((field) => field.toLowerCase().includes(q)),
  )
}

/** Villes uniques, pour proposer des destinations dans la recherche. */
export const cities = Array.from(
  artists
    .reduce((map, a) => {
      const existing = map.get(a.city)
      if (existing) existing.count += 1
      else map.set(a.city, { city: a.city, country: a.country, flag: a.flag, coordinates: a.coordinates, count: 1 })
      return map
    }, new Map<string, { city: string; country: string; flag: string; coordinates: [number, number]; count: number }>())
    .values(),
)
