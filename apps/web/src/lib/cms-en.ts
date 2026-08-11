import type { CmsContent } from './cms'

/**
 * Miroir anglais complet de DEFAULT_CONTENT.
 * Utilisé comme base du contenu EN du CMS : chaque champ encore vide en base
 * (content_en) prend sa valeur anglaise par défaut ici. Les valeurs publiées
 * en base (content_en) écrasent ensuite ces défauts.
 */
export const DEFAULT_CONTENT_EN: CmsContent = {
  landing: {
    hero: {
      title: 'Discover the artists around you.',
      subtitle: 'A new way to explore music through geolocation.',
      ctaPrimary: 'Explore the map',
      ctaPrimaryTo: '/globe',
      ctaSecondary: 'Join the waitlist',
      ctaSecondaryTo: '#waitlist',
    },
    features: {
      title: 'A new way to discover.',
      subtitle: 'Forget algorithms, explore territories.',
      items: [
        {
          title: 'Around you',
          text: 'Discover the talents creating just around the corner.',
          image: 'import:autour-de-vous',
          alt: 'Neighborhood acoustic concert surrounded by listeners',
        },
        {
          title: 'Explore',
          text: 'Travel from city to city, from continent to continent.',
          image: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&q=80&w=800',
          alt: 'Exploration map',
        },
        {
          title: 'Travel',
          text: "Immerse yourself in a territory's musical culture.",
          image: 'import:voyager',
          alt: 'Traveller using Musimaps in front of a village by a lake',
        },
      ],
    },
    journey: {
      items: [
        { title: '1. Allow', text: 'Enable your location to reveal local artists.' },
        { title: '2. Reveal', text: 'The map comes alive and reveals thousands of points.' },
        { title: '3. Discover', text: "Dive into an unknown artist's universe." },
        { title: '4. Listen', text: 'Experience their music where it was born.' },
      ],
    },
    globePreview: {
      title: 'The whole world, artist by artist.',
      subtitle: 'Spin the map, search a city, zoom down to the street. Every point is a creator.',
      cta: 'Explore the map',
      ctaTo: '/globe',
    },
    philosophy: {
      title: "Musimaps is building the world's first map for discovering artists.",
    },
    faq: {
      title: 'Frequently asked questions',
      subtitle: 'Everything you need to know before the expedition.',
      items: [
        {
          question: 'How does Musimaps work?',
          answer:
            'Musimaps turns geolocation into a music discovery playground: artists appear as points on a world map, and each point opens a universe (bio, tracks, dates).',
        },
        {
          question: 'Is it free?',
          answer:
            'Yes. Exploring the map, searching cities and discovering artists is completely free, forever.',
        },
        {
          question: "I'm an artist, how do I appear on the map?",
          answer:
            "Fill in the form on the artists page: your profile will be listed in its place on the map at launch.",
        },
        {
          question: 'Which devices is Musimaps available on?',
          answer:
            'Musimaps is accessible from the browser (web) and via the iOS and Android mobile app.',
        },
      ],
    },
    waitlist: {
      title: 'Be among the first.',
      subtitle: "Join the expedition and redefine the way you consume music.",
      legend: 'I am joining as',
      emailPlaceholder: 'your@email.com',
      ctaLabel: 'Join the waitlist',
      successTitle: 'Thank you, you are in!',
      successSubtitle: 'Redirecting to your confirmation…',
      profiles: [
        { id: 'artiste', label: 'Artist', description: 'I create music and want to be on the map.' },
        { id: 'amateur', label: 'Music lover', description: 'I want to discover artists.' },
      ],
    },
    stores: {
      badge: 'Mobile apps',
      title: 'Coming soon.',
      subtitle:
        'Musimaps is coming to iOS and Android. Join the waitlist to be notified at launch.',
      appStoreUrl: 'https://apps.apple.com/app/musimaps',
      playStoreUrl: 'https://play.google.com/store/apps/details?id=com.musimaps.app',
      appStoreLabel: 'App Store',
      playStoreLabel: 'Google Play',
      soonLabel: 'Coming soon',
    },
  },
  seo: {
    title: 'Musimaps | The living music map',
    description:
      'A new way to explore music through geolocation. Discover the artists around you.',
    ogTitle: 'Musimaps — The living music map',
    ogDescription:
      'Discover artists around you and explore music territory by territory.',
    ogImage: '/og-image.jpg',
    keywords: 'music, artists, map, geolocation, discovery, exploration',
    twitterCard: 'summary_large_image',
    twitterTitle: 'Musimaps — The living music map',
    twitterDescription:
      'Discover artists around you and explore music territory by territory.',
    twitterImage: '/og-image.jpg',
  },
  nav: {
    links: [
      { label: 'The map', to: '/globe' },
      { label: 'Artists', to: '/artistes' },
    ],
    ctaLabel: 'Join the list',
  },
  footer: {
    tagline: 'The living music map.',
    copyright: '© Musimaps. The living music map.',
    links: [
      { label: 'The map', to: '/globe' },
      { label: 'Artists space', to: '/artistes' },
      { label: 'Waitlist', to: '/#waitlist' },
    ],
    socials: [
      {
        label: 'X',
        to: 'https://x.com/intent/post?text=D%C3%A9couvrez%20Musimaps%20%E2%80%94%20la%20carte%20vivante%20de%20la%20musique',
        icon: 'x',
      },
    ],
  },
  brand: {
    navbarLogoLight: '',
    navbarLogoDark: '',
    footerLogoLight: '',
    footerLogoDark: '',
    favicon: '',
    appImage: '',
    navbarLogoHeight: 40,
    footerLogoHeight: 32,
  },
  badges: [
    {
      id: 'first-city',
      icon: 'navigate',
      label: 'First step',
      description: 'Visit your first city',
      points: 10,
      condition: { metric: 'cities', min: 1 },
    },
    {
      id: 'cities-3',
      icon: 'compass',
      label: 'Curious',
      description: 'Visit 3 cities',
      points: 25,
      condition: { metric: 'cities', min: 3 },
    },
    {
      id: 'cities-8',
      icon: 'earth',
      label: 'Globe-trotter',
      description: 'Visit 8 cities',
      points: 60,
      condition: { metric: 'cities', min: 8 },
    },
    {
      id: 'cities-15',
      icon: 'planet',
      label: 'Explorer',
      description: 'Visit 15 cities',
      points: 120,
      condition: { metric: 'cities', min: 15 },
    },
    {
      id: 'first-save',
      icon: 'heart',
      label: 'Crush',
      description: 'Save an artist',
      points: 10,
      condition: { metric: 'favorites', min: 1 },
    },
    {
      id: 'saves-5',
      icon: 'musical-notes',
      label: 'Music lover',
      description: 'Save 5 artists',
      points: 30,
      condition: { metric: 'favorites', min: 5 },
    },
    {
      id: 'saves-12',
      icon: 'sparkles',
      label: 'Collector',
      description: 'Save 12 artists',
      points: 80,
      condition: { metric: 'favorites', min: 12 },
    },
    {
      id: 'profile',
      icon: 'person',
      label: 'Ambassador',
      description: 'Create your profile',
      points: 20,
      condition: { metric: 'profile', min: 1 },
    },
  ],
  artistSignup: {
    badge: 'Calling all artists',
    title: 'Be on the map at launch.',
    subtitle:
      "Musimaps lists creators territory by territory. Request your spot before launch — the first profiles will be the first to be seen.",
    ctaLabel: 'Request my listing',
    privacyNote: 'No data is shared. We only write to you about the launch.',
    perks: [
      {
        title: 'Pinned on the map',
        text: 'Your city, your scene, your sound — visible from day one.',
      },
      {
        title: 'A local audience',
        text: 'Listeners find you because you create near them.',
      },
      {
        title: 'Worldwide reach',
        text: 'A traveller landing in your city comes across your profile.',
      },
    ],
  },
  settings: {
    launchDate: '2026-08-19T12:00:00Z',
    launchLabel: 'Launching in',
    onlineLabel: 'Musimaps is live.',
    openSignup: true,
    closedSignupMessage:
      'Account creation opens after launch. Your spot on the map is reserved if you are on the waitlist.',
  },
  onboarding: {
    slides: [
      {
        icon: 'Globe',
        chip: 'Interactive globe',
        title: 'The living map of music',
        text: 'Explore the globe and discover artists from around the world.',
      },
      {
        icon: 'Search',
        chip: 'Global search',
        title: 'Find your next discovery',
        text: 'Search a city or an artist. Every corner of the world has its own music scene.',
      },
      {
        icon: 'Heart',
        chip: 'Saved artists',
        title: 'Save your favorites',
        text: 'Keep your favorite artists close and build your collection.',
      },
      {
        icon: 'Trophy',
        chip: 'Gamification & sharing',
        title: 'Explore, earn, share',
        text: 'Visit cities and save artists to earn points, level up and unlock badges.',
      },
    ],
  },
}
