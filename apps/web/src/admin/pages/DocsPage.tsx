import { useLanguage } from '@/i18n/LanguageContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  BookOpen,
  Globe2,
  Users,
  CalendarCheck2,
  Languages,
  Trophy,
  SunMoon,
  Smartphone,
  Info,
} from 'lucide-react'

interface Block {
  icon: typeof Info
  title: string
  intro: string
  points: Array<{ label: string; detail: string }>
}

interface DocContent {
  kicker: string
  title: string
  intro: string
  sections: Block[]
  note: string
}

const FR: DocContent = {
  kicker: 'GUIDE ADMIN',
  title: 'Comment fonctionne Musimaps ?',
  intro:
    'Ce guide explique, en français, chaque brique du produit : comment les artistes arrivent sur la carte, comment les réservations sont sécurisées, et comment piloter le contenu. Tout ce qui est décrit ici est bilingue (FR/EN) et synchronisé entre le site web et l’app mobile Expo.',
  sections: [
    {
      icon: Globe2,
      title: '1. La découverte d’artistes (Musibrainz)',
      intro:
        'C’est le « scraper » du site. Quand un visiteur cherche un artiste absent du catalogue, Musimaps interroge la base mondiale ouverte Musibrainz pour le trouver.',
      points: [
        {
          label: 'Recherche web',
          detail:
            'Sur le globe, si « Aucun résultat », un bouton « Rechercher sur le web » appelle l’API publique Musibrainz (sans clé, identifié par un User-Agent Musimaps). Elle renvoie nom, genre, pays, ville (area) et bio.',
        },
        {
          label: 'Géolocalisation',
          detail:
            'Chaque candidat est géocodé via Mapbox (ville, pays → coordonnées GPS). Sans localisation trouvable, l’artiste n’est pas ajouté (message dédié).',
        },
        {
          label: 'Stockage partagé',
          detail:
            'L’artiste est enregistré dans la table Supabase map_artists (source = musicbrainz). Le globe web ET l’app mobile lisent cette même table : l’ajout fait sur le web apparaît aussitôt sur mobile, et inversement.',
        },
        {
          label: 'Cette page',
          detail:
            'Ici vous pouvez consulter, filtrer, exporter (CSV) et supprimer les artistes découverts. La suppression les retire du globe ; le catalogue éditorial (package shared) n’est pas touché.',
        },
        {
          label: 'Limites',
          detail:
            'Un artiste découvert a une identité minimale : pas de titres, pas d’événements, une couleur par défaut. Pour un profil complet, l’artiste doit passer par le catalogue éditorial ou un compte artiste validé.',
        },
      ],
    },
    {
      icon: Users,
      title: '2. Comptes artiste & mélomane',
      intro:
        'Deux rôles, un seul système d’authentification Supabase. La page de création de compte propose « Artiste » ou « Mélomane ».',
      points: [
        {
          label: 'Rôle à l’inscription',
          detail:
            'Le trigger handle_new_user copie le rôle (artist/melomane) du JWT vers profiles.role, avec nom et ville. La fonction is_artist() est utilisée par les politiques de sécurité.',
        },
        {
          label: 'Dashboards',
          detail:
            'Web (/fr/dashboard) et mobile (onglet Profil) : le mélomane voit ses demandes de réservation ; l’artiste voit les demandes reçues. Le menu de la navbar change selon la connexion.',
        },
        {
          label: 'Administrateurs',
          detail:
            'Un compte devient admin via la table admins. Bootstrap : le tout premier compte connecté devient admin automatiquement, ensuite seuls les admins peuvent en ajouter.',
        },
      ],
    },
    {
      icon: CalendarCheck2,
      title: '3. Les réservations (booking)',
      intro:
        'La réservation est réservée aux comptes abonnés (table subscribers, gérée par vos soins) et passe par un formulaire en 8 étapes.',
      points: [
        {
          label: 'Formulaire 8 étapes',
          detail:
            'Type d’événement → Date (ou « je suis flexible ») → Lieu (ville/pays/adresse) → Budget (fourchettes ou montant libre) → Taille du public → Message → Coordonnées → Préférences de contact.',
        },
        {
          label: 'Email automatique',
          detail:
            'Le formulaire ne demande jamais l’email : il vient du compte connecté. La procédure RPC request_booking (SECURITY DEFINER) lit auth.jwt() et vérifie que l’adresse est bien abonnée — impossible de spoof l’email d’un autre.',
        },
        {
          label: 'Sécurité',
          detail:
            'Un artiste ne voit les demandes reçues que si son compte a bien le rôle artiste (anti-usurpation via display_name). Les insertions directes sont bloquées ; seul le RPC sécurisé insère.',
        },
        {
          label: 'Suivi',
          detail:
            'La page « Réservations » de l’admin liste tout (type, date, lieu, budget, public, message, contact, statut) avec export CSV enrichi.',
        },
      ],
    },
    {
      icon: Languages,
      title: '4. CMS bilingue (FR/EN)',
      intro:
        'Tous les contenus éditables ont une version française et une version anglaise.',
      points: [
        {
          label: 'LangSwitch',
          detail:
            'Chaque page d’édition (Sections, SEO, Navigation & footer, Brand) a un interrupteur FR/EN : vous modifiez chaque langue séparément puis publiez les deux d’un coup.',
        },
        {
          label: 'Brouillon / publication',
          detail:
            'Les modifications restent en brouillon tant que vous ne cliquez pas « Publier ». La vue publique ne lit que le contenu publié (et sa version EN).',
        },
        {
          label: 'URLs par langue',
          detail:
            'Le site existe en /fr/... et /en/... (ex : /fr/dashboard, /en/dashboard). La langue se détecte automatiquement (navigateur puis IP) et chaque lien interne garde la langue.',
        },
        {
          label: 'Logo, favicon, stores',
          detail:
            'Dans « Logo & favicon » : logos navbar clair/sombre (image, pas de texte), favicon et image d’app — tous appliqués au site. Dans « Réglages » : liens App Store / Google Play pour la section « Bientôt disponible ».',
        },
      ],
    },
    {
      icon: Trophy,
      title: '5. Gamification',
      intro:
        'Points, niveaux et badges encouragent l’exploration, aussi bien dans l’app que sur le web.',
      points: [
        {
          label: 'Badges & niveaux',
          detail:
            'Le catalogue de badges est pilotable ici (icônes, couleurs, libellés). L’app mobile attribue points et niveaux, avec des libellés EN intégrés en repli.',
        },
        {
          label: 'Historique',
          detail:
            'La page « Historique » garde la trace des publications de contenu pour revenir en arrière si besoin.',
        },
      ],
    },
    {
      icon: SunMoon,
      title: '6. Thème & langues automatiques',
      intro:
        'Aucun réglage à faire : tout suit le visiteur.',
      points: [
        {
          label: 'Thème',
          detail:
            'Le thème clair/sombre suit le système (prefers-color-scheme sur le web, Appearance sur mobile). Il n’y a plus de sélecteur manuel : suppression du localStorage musimaps.theme.',
        },
        {
          label: 'Langue',
          detail:
            'Détection par le navigateur, puis par l’IP (pays francophone → fr, sinon en), sans sélecteur. L’app mobile détecte la langue de l’appareil via expo-localization.',
        },
      ],
    },
    {
      icon: Smartphone,
      title: '7. Synchronisation web ↔ mobile',
      intro:
        'Le web (React + Vite + Mapbox) et l’app (Expo / React Native) partagent le même backend Supabase et le même catalogue.',
      points: [
        {
          label: 'Catalogue partagé',
          detail:
            'Le package @musimaps/shared contient artistes, villes et recherche ; il est traduit par localizeArtist (bio, genre, ville, pays, événements).',
        },
        {
          label: 'Données communes',
          detail:
            'Waitlist, profils, favoris, villes visitées, badges, artistes découverts et réservations : tout vit dans Supabase, chaque app lit/écrit les mêmes tables avec les mêmes politiques.',
        },
        {
          label: 'Découverte mobile',
          detail:
            'L’app mobile a aussi la recherche Musibrainz : un artiste ajouté sur mobile apparaît sur le web et inversement.',
        },
      ],
    },
  ],
  note: 'Astuce : le premier compte créé devient administrateur. Pour donner l’accès à quelqu’un, ajoutez son email dans la page « Réglages » (table admins).',
}

const EN: DocContent = {
  kicker: 'ADMIN GUIDE',
  title: 'How does Musimaps work?',
  intro:
    'This guide explains each building block: how artists reach the map, how bookings are secured, and how to run the content. Everything described here is bilingual (FR/EN) and synchronized between the website and the Expo mobile app.',
  sections: [
    {
      icon: Globe2,
      title: '1. Artist discovery (Musibrainz)',
      intro:
        'This is the site “scraper”. When a visitor searches for an artist missing from the catalog, Musimaps queries the open worldwide Musibrainz database to find them.',
      points: [
        {
          label: 'Web search',
          detail:
            'On the globe, when “No results” appears, a “Search the web” button calls the public Musibrainz API (no key, identified by a Musimaps User-Agent). It returns name, genre, country, area and bio.',
        },
        {
          label: 'Geolocation',
          detail:
            'Each candidate is geocoded via Mapbox (city, country → GPS coordinates). Without a findable location, the artist is not added (dedicated message).',
        },
        {
          label: 'Shared storage',
          detail:
            'The artist is stored in the Supabase map_artists table (source = musicbrainz). Both the web globe AND the mobile app read this same table: an artist added on the web shows up instantly on mobile, and vice versa.',
        },
        {
          label: 'This page',
          detail:
            'Here you can view, filter, export (CSV) and delete discovered artists. Deleting removes them from the globe; the editorial catalog (shared package) is untouched.',
        },
        {
          label: 'Limits',
          detail:
            'A discovered artist has a minimal identity: no tracks, no events, a default color. For a full profile, the artist must go through the editorial catalog or a validated artist account.',
        },
      ],
    },
    {
      icon: Users,
      title: '2. Artist & music-lover accounts',
      intro:
        'Two roles, one Supabase authentication system. The signup page offers “Artist” or “Music lover”.',
      points: [
        {
          label: 'Role at signup',
          detail:
            'The handle_new_user trigger copies the role (artist/melomane) from the JWT into profiles.role, with name and city. The is_artist() function is used by the security policies.',
        },
        {
          label: 'Dashboards',
          detail:
            'Web (/fr/dashboard) and mobile (Profile tab): the music lover sees their booking requests; the artist sees received requests. The navbar menu changes based on the session.',
        },
        {
          label: 'Administrators',
          detail:
            'An account becomes admin through the admins table. Bootstrap: the very first connected account becomes admin automatically; afterwards only admins can add more.',
        },
      ],
    },
    {
      icon: CalendarCheck2,
      title: '3. Bookings',
      intro:
        'Booking is reserved for subscriber accounts (subscribers table, managed by you) and goes through an 8-step form.',
      points: [
        {
          label: '8-step form',
          detail:
            'Event type → Date (or “I am flexible”) → Location (city/country/address) → Budget (ranges or free amount) → Audience size → Message → Contact details → Contact preferences.',
        },
        {
          label: 'Automatic email',
          detail:
            'The form never asks for the email: it comes from the signed-in account. The request_booking RPC (SECURITY DEFINER) reads auth.jwt() and checks that the address is actually a subscriber — no spoofing another user’s email.',
        },
        {
          label: 'Security',
          detail:
            'An artist only sees received requests if their account really has the artist role (anti-spoofing via display_name). Direct inserts are blocked; only the secured RPC inserts.',
        },
        {
          label: 'Tracking',
          detail:
            'The “Bookings” admin page lists everything (type, date, location, budget, audience, message, contact, status) with enriched CSV export.',
        },
      ],
    },
    {
      icon: Languages,
      title: '4. Bilingual CMS (FR/EN)',
      intro: 'Every editable piece of content has both a French and an English version.',
      points: [
        {
          label: 'LangSwitch',
          detail:
            'Each editing page (Sections, SEO, Navigation & footer, Brand) has a FR/EN switch: edit each language separately, then publish both at once.',
        },
        {
          label: 'Draft / publish',
          detail:
            'Changes stay as drafts until you click “Publish”. The public view only reads published content (and its EN version).',
        },
        {
          label: 'Language URLs',
          detail:
            'The site exists as /fr/... and /en/... (e.g. /fr/dashboard, /en/dashboard). Language is detected automatically (browser then IP) and every internal link keeps the language.',
        },
        {
          label: 'Logo, favicon, stores',
          detail:
            'In “Logo & favicon”: light/dark navbar logos (image, not text), favicon and app image — all applied to the site. In “Settings”: App Store / Google Play links for the “Coming soon” section.',
        },
      ],
    },
    {
      icon: Trophy,
      title: '5. Gamification',
      intro: 'Points, levels and badges encourage exploration, both in the app and on the web.',
      points: [
        {
          label: 'Badges & levels',
          detail:
            'The badge catalog is manageable here (icons, colors, labels). The mobile app awards points and levels, with built-in EN labels as fallback.',
        },
        {
          label: 'History',
          detail:
            'The “History” page tracks content publications so you can roll back if needed.',
        },
      ],
    },
    {
      icon: SunMoon,
      title: '6. Automatic theme & languages',
      intro: 'Nothing to configure: everything follows the visitor.',
      points: [
        {
          label: 'Theme',
          detail:
            'Light/dark follows the system (prefers-color-scheme on web, Appearance on mobile). No manual toggle anymore: musimaps.theme localStorage was removed.',
        },
        {
          label: 'Language',
          detail:
            'Detected via the browser, then via the IP (francophone country → fr, otherwise en), with no selector. The mobile app detects the device language via expo-localization.',
        },
      ],
    },
    {
      icon: Smartphone,
      title: '7. Web ↔ mobile sync',
      intro: 'The web (React + Vite + Mapbox) and the app (Expo / React Native) share the same Supabase backend and catalog.',
      points: [
        {
          label: 'Shared catalog',
          detail:
            'The @musimaps/shared package holds artists, cities and search; it is translated via localizeArtist (bio, genre, city, country, events).',
        },
        {
          label: 'Common data',
          detail:
            'Waitlist, profiles, favorites, visited cities, badges, discovered artists and bookings all live in Supabase; each app reads/writes the same tables with the same policies.',
        },
        {
          label: 'Mobile discovery',
          detail:
            'The mobile app also has Musibrainz search: an artist added on mobile appears on the web and vice versa.',
        },
      ],
    },
  ],
  note: 'Tip: the first account created becomes administrator. To grant access to someone, add their email in the “Settings” page (admins table).',
}

export default function DocsPage() {
  const { lang } = useLanguage()
  const doc = lang === 'fr' ? FR : EN

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex items-start gap-3">
        <span className="bg-brand-soft text-brand-deep flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
          <BookOpen className="size-5" />
        </span>
        <div>
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-widest">
            {doc.kicker}
          </p>
          <h1 className="text-2xl font-bold">{doc.title}</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
            {doc.intro}
          </p>
        </div>
      </div>

      {doc.sections.map((section) => (
        <Card key={section.title}>
          <CardHeader>
            <div className="flex items-start gap-3">
              <span className="bg-brand-soft text-brand-deep flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                <section.icon className="size-5" />
              </span>
              <div>
                <CardTitle>{section.title}</CardTitle>
                <CardDescription className="max-w-xl leading-relaxed">
                  {section.intro}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3">
            {section.points.map((point, index) => (
              <div key={point.label}>
                {index > 0 && <Separator className="mb-3" />}
                <div className="flex items-start gap-3">
                  <Badge variant="secondary" className="mt-0.5 shrink-0">
                    {point.label}
                  </Badge>
                  <p className="text-muted-foreground text-sm leading-relaxed">{point.detail}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <div className="bg-muted/60 text-muted-foreground rounded-xl border p-4 text-sm leading-relaxed">
        <span className="font-medium">💡 </span>
        {doc.note}
      </div>
    </div>
  )
}
