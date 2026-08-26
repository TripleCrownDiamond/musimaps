import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import {
  AlertTriangle,
  BookOpenCheck,
  CalendarHeart,
  FileText,
  Globe2,
  History,
  LayoutDashboard,
  ListChecks,
  Medal,
  Mic2,
  Navigation,
  Palette,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Smartphone,
  Trophy,
} from 'lucide-react'

/**
 * Guide d'édition de l'admin — mode d'emploi, page par page.
 *
 * Complémentaire de « Documentation » (`DocsPage`), qui explique comment le
 * produit fonctionne. Ici, on répond à une seule question : **que faire
 * concrètement sur cette page, et qu'est-ce que ça change en ligne ?**
 *
 * Français uniquement, comme les 16 autres pages de l'admin : le bilingue
 * concerne le contenu publié, pas l'outil d'administration.
 */

interface Entry {
  /** Ce que l'administrateur veut faire. */
  label: string
  /** Comment le faire, et ce que ça produit. */
  detail: string
}

interface Section {
  icon: typeof Settings
  title: string
  /** Route admin, pour aller directement à la page décrite. */
  to?: string
  intro: string
  entries: Entry[]
  /** Piège connu — ce qui fait perdre une heure quand on l'ignore. */
  warning?: string
}

/**
 * Règle commune à toutes les sections pilotées par le CMS. Répétée ici parce
 * que c'est la source n°1 de « j'ai modifié mais rien ne change ».
 */
const PUBLISH_RULE =
  'Enregistrer garde votre travail en brouillon — le site public ne bouge pas. ' +
  'Publier met le brouillon en ligne. Tant que le bandeau indique des modifications ' +
  'non publiées, vos visiteurs voient encore l’ancienne version.'

const SECTIONS: Section[] = [
  {
    icon: Trophy,
    title: 'Catalogue badges — la gamification',
    to: '/admin/badges',
    intro:
      'La seule page qui définit les badges. Le web et l’application mobile lisent tous deux ' +
      'le catalogue publié ici : une publication touche les deux surfaces à la fois.',
    entries: [
      {
        label: 'Ajouter un badge',
        detail:
          'Bouton d’ajout en bas de la liste. Un identifiant unique est généré automatiquement ; ' +
          'remplissez au minimum le libellé, sinon l’enregistrement est refusé.',
      },
      {
        label: 'Supprimer / réordonner',
        detail:
          'Icône corbeille sur la ligne. Les flèches Monter et Descendre changent l’ordre ' +
          'd’affichage dans l’app. Supprimer un badge le retire de tous les profils.',
      },
      {
        label: 'Points',
        detail:
          'Ils s’ajoutent au score dès que la condition est remplie, et l’effet est RÉTROACTIF : ' +
          'un utilisateur qui remplissait déjà la condition obtient le badge à la prochaine ouverture.',
      },
      {
        label: 'Rôle',
        detail:
          '« Tous » l’affiche à chacun ; « Mélomane » et « Artiste » le réservent à ce type de ' +
          'compte. Un badge artiste n’apparaît jamais chez un mélomane.',
      },
      {
        label: 'Condition',
        detail:
          'Une métrique et un seuil. Les métriques disponibles sont : villes visitées, favoris, ' +
          'profil créé, artistes suivis, jours d’affilée, réservations envoyées, profil revendiqué, ' +
          'vues de profil, réservations reçues, dates de concert.',
      },
      {
        label: 'Icône',
        detail:
          'Un nom du vocabulaire partagé (star, heart, compass, flame, crown…). Chaque plateforme ' +
          'le traduit dans sa propre bibliothèque — Lucide sur le web, Ionicons sur mobile. ' +
          'Un nom inconnu n’affiche aucune icône.',
      },
      {
        label: 'FR / EN',
        detail:
          'Le sélecteur de langue en haut publie un catalogue par langue. Traduisez libellé et ' +
          'description dans les deux, sinon les anglophones voient du français.',
      },
    ],
    warning:
      'Les NIVEAUX (Explorateur, Voyageur, Globe-trotter, Navigateur, Connaisseur, Légende) ne ' +
      'sont PAS éditables ici : ils sont codés en dur. Les badges territoriaux (« 5 villes du ' +
      'Bénin ») et les badges rares (« parmi les 100 premiers ») ne sont pas non plus ' +
      'réalisables avec les métriques actuelles — ils demandent du développement.',
  },
  {
    icon: Medal,
    title: 'Badges & trophées — le classement',
    to: '/admin/gamification',
    intro:
      'Vue de suivi, en LECTURE SEULE. Rien de ce qui s’y affiche ne peut être modifié : ' +
      'pour changer les badges, passez par « Catalogue badges ».',
    entries: [
      {
        label: 'À quoi ça sert',
        detail:
          'Voir qui progresse : points, niveau, nombre de badges, villes visitées et favoris ' +
          'par utilisateur. Utile pour vérifier qu’un badge nouvellement publié se débloque bien.',
      },
      {
        label: 'Après une publication',
        detail:
          'Les compteurs se mettent à jour quand l’utilisateur rouvre l’app, pas immédiatement. ' +
          'Un classement inchangé cinq minutes après une publication est normal.',
      },
    ],
  },
  {
    icon: FileText,
    title: 'Sections (landing) & FAQ',
    to: '/admin/sections',
    intro:
      'Tout le contenu de la page d’accueil : titres, sous-titres, boutons, blocs de ' +
      'fonctionnalités, questions fréquentes.',
    entries: [
      {
        label: 'Boutons d’appel',
        detail:
          'Chaque bouton a un libellé et une destination. La destination est un chemin interne ' +
          '(/globe, /signup) — pas une URL complète, sinon le lien sort du site.',
      },
      {
        label: 'FAQ',
        detail:
          'Onglet dédié. Ajout, suppression et réordonnancement par les flèches. L’ordre ici est ' +
          'l’ordre affiché sur la landing.',
      },
      { label: 'Publication', detail: PUBLISH_RULE },
    ],
  },
  {
    icon: Search,
    title: 'SEO & partage social',
    to: '/admin/seo',
    intro:
      'Titre et description dans Google, et surtout l’aperçu qui s’affiche quand quelqu’un ' +
      'partage un lien Musimaps sur WhatsApp, LinkedIn, Facebook ou X.',
    entries: [
      {
        label: 'Image de partage (og:image)',
        detail:
          'Format 1200 × 630 px. Visez moins de 300 Ko : au-delà, WhatsApp n’affiche aucun ' +
          'aperçu. Une image par langue — la version anglaise sert /en.',
      },
      {
        label: 'Titre et description',
        detail:
          'Environ 60 caractères pour le titre, 155 pour la description. Au-delà, Google et les ' +
          'réseaux coupent la phrase au milieu.',
      },
      {
        label: 'Mise en ligne',
        detail:
          'Ces balises sont gravées dans le HTML AU MOMENT DU BUILD. Publier depuis l’admin ne ' +
          'suffit pas : il faut redéployer le site pour que les réseaux voient le changement.',
      },
      {
        label: 'Aperçu figé',
        detail:
          'Les réseaux gardent longtemps en cache le premier aperçu vu. Après un déploiement, ' +
          'forcez une relecture avec le débogueur de partage de Facebook ou le Post Inspector ' +
          'de LinkedIn, sinon vous verrez encore l’ancienne image.',
      },
    ],
    warning:
      'Modifier l’image ici sans redéployer ne change RIEN au partage. C’est le piège le plus ' +
      'coûteux de cette page.',
  },
  {
    icon: Palette,
    title: 'Logo & favicon',
    to: '/admin/brand',
    intro:
      'Logos de la barre de navigation et du pied de page, favicon de l’onglet, image de l’app.',
    entries: [
      {
        label: 'Clair et sombre',
        detail:
          'Deux logos : le clair s’affiche sur fond clair, le sombre sur fond sombre. Si un seul ' +
          'est renseigné, il sert les deux thèmes. Si aucun ne l’est, le logo officiel embarqué ' +
          'prend le relais — c’est un repli sûr, pas une erreur.',
      },
      {
        label: 'Hauteur',
        detail:
          'Réglable en pixels pour la navbar et le footer, avec aperçu immédiat dans les deux thèmes.',
      },
      {
        label: 'Anciens logos',
        detail:
          'Les anciens logos cyan sont automatiquement retirés du brouillon à l’ouverture. ' +
          'Un bandeau vous le signale : publiez pour rendre la suppression définitive.',
      },
      {
        label: 'Favicon',
        detail:
          'Elle est mise en cache très agressivement par les navigateurs. Après publication et ' +
          'déploiement, testez en navigation privée — votre onglet gardera l’ancienne longtemps.',
      },
    ],
  },
  {
    icon: Navigation,
    title: 'Navigation & footer',
    to: '/admin/navigation',
    intro: 'Liens du menu principal et des colonnes du pied de page.',
    entries: [
      {
        label: 'Destinations',
        detail:
          'Chemin interne pour une page du site (/globe, /artistes), URL complète avec https:// ' +
          'pour un site externe.',
      },
      {
        label: 'Ordre',
        detail: 'Les flèches définissent l’ordre affiché, à l’identique sur le web et le mobile.',
      },
    ],
  },
  {
    icon: Mic2,
    title: 'Page artistes',
    to: '/admin/artistes',
    intro: 'Contenu de la page de recrutement des artistes (/artistes).',
    entries: [
      {
        label: 'Argumentaire',
        detail:
          'Titre, accroche et bénéfices affichés aux artistes qui découvrent Musimaps. ' +
          'C’est la page qui convertit un artiste en inscription.',
      },
      { label: 'Publication', detail: PUBLISH_RULE },
    ],
  },
  {
    icon: Smartphone,
    title: 'Onboarding app',
    to: '/admin/onboarding',
    intro: 'Les écrans d’accueil vus au tout premier lancement de l’application mobile.',
    entries: [
      {
        label: 'Écrans',
        detail:
          'Titre et texte de chaque étape. Restez court : ces écrans sont lus en trois secondes ' +
          'sur un téléphone.',
      },
      {
        label: 'Portée',
        detail: 'Mobile uniquement. Ces écrans n’apparaissent nulle part sur le web.',
      },
    ],
  },
  {
    icon: ListChecks,
    title: 'Liste d’attente',
    to: '/admin/waitlist',
    intro:
      'Les artistes et mélomanes inscrits avant l’ouverture, avec leur position dans la file.',
    entries: [
      {
        label: 'Lecture',
        detail:
          'Consultez et exportez les inscriptions. Une ligne de liste d’attente se rattache ' +
          'automatiquement au compte quand la personne s’inscrit avec la même adresse.',
      },
      {
        label: 'Données personnelles',
        detail:
          'Cette page contient des adresses email réelles. N’exportez que ce dont vous avez ' +
          'besoin et ne partagez pas le fichier.',
      },
    ],
  },
  {
    icon: Globe2,
    title: 'Artistes découverts',
    to: '/admin/discovered',
    intro:
      'Le cœur de la carte : les artistes trouvés via MusicBrainz, à valider, corriger ou placer.',
    entries: [
      {
        label: 'Position',
        detail:
          'Ville, pays et quartier déterminent le pin. Le quartier (Yopougon, Bastille) évite ' +
          'que deux artistes d’une même ville se superposent au centre.',
      },
      {
        label: 'Vérifier',
        detail:
          'Un artiste vérifié porte un badge sur sa fiche. Ne cochez que si l’identité est ' +
          'confirmée — c’est un signal de confiance pour le public.',
      },
      {
        label: 'Liens',
        detail:
          'Plateformes d’écoute et réseaux sociaux. Ils s’affichent sur la fiche artiste ; ' +
          'une URL invalide produit un lien mort visible de tous.',
      },
      {
        label: 'Lien personnalisé',
        detail:
          'Le champ slug donne une adresse lisible : /artist/mon-nom plutôt qu’un identifiant. ' +
          'Un slug déjà pris est refusé à l’enregistrement.',
      },
      {
        label: 'Morceaux',
        detail:
          'Ils ne se saisissent pas ici : la fiche va les chercher automatiquement sur Apple ' +
          'Music à partir du NOM de l’artiste. Un nom mal orthographié, et l’onglet Musiques ' +
          'reste vide — c’est la première chose à vérifier.',
      },
    ],
    warning:
      'Supprimer un artiste le retire de la carte pour tout le monde, immédiatement, sans ' +
      'passer par une publication.',
  },
  {
    icon: ShieldCheck,
    title: 'Revendications',
    to: '/admin/claims',
    intro: 'Les artistes qui demandent à récupérer la fiche les concernant sur la carte.',
    entries: [
      {
        label: 'Avant d’accepter',
        detail:
          'Vérifiez que la personne est bien l’artiste — un compte officiel, un email de domaine, ' +
          'un lien depuis ses réseaux. Une revendication accordée donne le contrôle de la fiche.',
      },
      {
        label: 'Conséquence',
        detail:
          'Le propriétaire peut ensuite modifier sa fiche et son lien personnalisé directement ' +
          'depuis la carte, sans passer par vous.',
      },
    ],
  },
  {
    icon: CalendarHeart,
    title: 'Réservations',
    to: '/admin/bookings',
    intro: 'Les demandes de booking envoyées par les comptes professionnels aux artistes.',
    entries: [
      {
        label: 'Suivi',
        detail:
          'Consultez les demandes et leur état. Les artistes réservables affichent leurs forfaits ' +
          'sur leur fiche publique.',
      },
      {
        label: 'Qui peut réserver',
        detail: 'Uniquement un compte de type « professionnel ». Un mélomane ne voit pas le bouton.',
      },
    ],
  },
  {
    icon: History,
    title: 'Historique',
    to: '/admin/history',
    intro: 'Toutes les publications passées, avec leur auteur et leur date.',
    entries: [
      {
        label: 'En cas d’erreur',
        detail:
          'C’est ici que vous retrouvez ce qui a été publié, quand, et par qui — le premier ' +
          'réflexe quand quelque chose a changé sur le site sans qu’on sache pourquoi.',
      },
    ],
  },
  {
    icon: RefreshCw,
    title: 'Cache',
    to: '/admin/cache',
    intro:
      'Purge du cache de l’hébergeur. À utiliser quand une modification publiée ne se voit ' +
      'toujours pas en ligne.',
    entries: [
      {
        label: 'Bon réflexe',
        detail:
          'Purgez APRÈS avoir publié et déployé, jamais avant : purger un cache qui contient ' +
          'encore l’ancienne version ne sert à rien.',
      },
      {
        label: 'Si ça ne suffit pas',
        detail:
          'Testez en navigation privée pour écarter le cache de votre propre navigateur, qui ' +
          'est une cause bien plus fréquente que le cache du serveur.',
      },
    ],
  },
  {
    icon: Settings,
    title: 'Réglages',
    to: '/admin/settings',
    intro: 'Ouverture des inscriptions, date de lancement, et accès administrateur.',
    entries: [
      {
        label: 'Inscriptions',
        detail:
          'Fermer les inscriptions remplace le formulaire par un message d’attente. Les comptes ' +
          'existants continuent de se connecter normalement.',
      },
      {
        label: 'Donner l’accès admin',
        detail:
          'Ajoutez l’adresse email de la personne dans la table des administrateurs. Elle doit ' +
          'utiliser exactement cette adresse pour se connecter.',
      },
    ],
    warning:
      'Retirer votre propre adresse de la liste des administrateurs vous déconnecte de l’admin ' +
      'sans possibilité de revenir par l’interface.',
  },
  {
    icon: LayoutDashboard,
    title: 'Vue d’ensemble',
    to: '/admin',
    intro: 'Le tableau de bord d’accueil : les chiffres clés de la plateforme en un coup d’œil.',
    entries: [
      {
        label: 'Usage',
        detail:
          'Point de départ quotidien : nombre d’artistes sur la carte, inscriptions, ' +
          'revendications en attente, demandes de réservation à traiter.',
      },
    ],
  },
]

/** Les réflexes qui résolvent la plupart des « ça ne marche pas ». */
const TROUBLESHOOTING: Entry[] = [
  {
    label: 'J’ai modifié, rien ne change',
    detail:
      'Avez-vous PUBLIÉ ? Enregistrer ne fait que sauvegarder un brouillon. Le bandeau en haut ' +
      'de page indique toujours s’il reste des modifications non publiées.',
  },
  {
    label: 'C’est publié, rien ne change',
    detail:
      'Testez en navigation privée. Si c’est bon, c’est votre cache navigateur. Sinon, purgez ' +
      'le cache de l’hébergeur depuis la page Cache.',
  },
  {
    label: 'Le partage montre l’ancienne image',
    detail:
      'Le SEO est gravé au build : il faut redéployer le site, puis forcer les réseaux à ' +
      'relire la page avec leur outil de débogage.',
  },
  {
    label: 'L’onglet Musiques est vide',
    detail:
      'Les morceaux viennent d’Apple Music, cherchés par le NOM de l’artiste. Vérifiez ' +
      'l’orthographe exacte dans « Artistes découverts ». Certains artistes très confidentiels ' +
      'n’y figurent simplement pas.',
  },
  {
    label: 'Un badge ne se débloque pas',
    detail:
      'Le calcul se fait à l’ouverture de l’app par l’utilisateur, pas en temps réel. ' +
      'Vérifiez aussi le rôle du badge : un badge « Artiste » n’apparaît jamais chez un mélomane.',
  },
]

export default function GuidePage() {
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const visible = q
    ? SECTIONS.filter((section) =>
        [section.title, section.intro, ...section.entries.flatMap((e) => [e.label, e.detail])]
          .join(' ')
          .toLowerCase()
          .includes(q),
      )
    : SECTIONS

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <span className="bg-brand-soft text-brand-deep flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
            <BookOpenCheck className="size-5" />
          </span>
          <div>
            <h1 className="text-2xl font-bold">Guide d’édition</h1>
            <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
              Mode d’emploi de chaque page : ce que vous pouvez y changer, et ce que ça produit
              en ligne. Pour comprendre le fonctionnement du produit lui-même, voyez
              « Documentation ».
            </p>
          </div>
        </div>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher dans le guide…"
          className="w-full md:w-64"
          aria-label="Rechercher dans le guide"
        />
      </div>

      {/* La règle qui explique à elle seule la majorité des incompréhensions. */}
      <div className="border-brand-deep/30 bg-brand-soft/50 rounded-xl border p-4">
        <p className="text-sm font-bold">Enregistrer ≠ Publier</p>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{PUBLISH_RULE}</p>
      </div>

      {visible.length === 0 && (
        <p className="text-muted-foreground py-12 text-center text-sm">
          Aucune section ne correspond à « {query} ».
        </p>
      )}

      {visible.map((section) => (
        <Card key={section.title}>
          <CardHeader>
            <div className="flex items-start gap-3">
              <span className="bg-brand-soft text-brand-deep flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                <section.icon className="size-5" />
              </span>
              <div className="min-w-0">
                <CardTitle className="flex flex-wrap items-center gap-2">
                  {section.title}
                  {section.to && (
                    <Link
                      to={section.to}
                      className="text-brand-deep text-xs font-medium underline-offset-4 hover:underline"
                    >
                      ouvrir la page
                    </Link>
                  )}
                </CardTitle>
                <CardDescription className="max-w-xl leading-relaxed">
                  {section.intro}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3">
            {section.entries.map((entry, index) => (
              <div key={entry.label}>
                {index > 0 && <Separator className="mb-3" />}
                <div className="flex items-start gap-3">
                  <Badge variant="secondary" className="mt-0.5 shrink-0">
                    {entry.label}
                  </Badge>
                  <p className="text-muted-foreground text-sm leading-relaxed">{entry.detail}</p>
                </div>
              </div>
            ))}
            {section.warning && (
              <div className="mt-1 flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-50 p-3 dark:bg-amber-950/30">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <p className="text-sm leading-relaxed">{section.warning}</p>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle>En cas de problème</CardTitle>
          <CardDescription>
            Les questions qui reviennent le plus, et leur réponse.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3">
          {TROUBLESHOOTING.map((entry, index) => (
            <div key={entry.label}>
              {index > 0 && <Separator className="mb-3" />}
              <div className="flex items-start gap-3">
                <Badge variant="outline" className="mt-0.5 shrink-0">
                  {entry.label}
                </Badge>
                <p className="text-muted-foreground text-sm leading-relaxed">{entry.detail}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
