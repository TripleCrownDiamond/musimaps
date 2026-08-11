# Musimaps — Concept « Discussions » (commentaires)

Document de concept pour la future fonctionnalité de commentaires sur les
profils artistes. Ce document **ne décrit que le concept** (nom, UX, règles,
schéma, sécurité) — rien n'est encore implémenté.

---

## 1. Le nom

Quelques pistes, avec ce qu'elles évoquent :

| Nom | Évoque | Verdict |
|---|---|---|
| **Commentaires** | Générique, compris par tous | ❌ trop neutre |
| **Discussions** | Échange, fil, communauté | ✅ clair et français |
| **Le Mur** | Réseau social, artiste parle à sa communauté | ✅ moderne, proche des artistes |
| **Cri du cœur / Shoutbox** | Nostalgique, pas sérieux | ❌ |
| **La Scène** | Cohérent avec le thème « musique vivante / carte » | ✅ original, à tester |
| **Messages** | Confusion avec la messagerie privée | ❌ |

**Recommandation : « Le Mur »** (FR) / **« The Wall »** (EN). Court, mémorable,
cohérent avec une carte vivante : le mur du son, le mur de l'artiste. Alternatives
solides : « Discussions ».

---

## 2. Objectif

Donner une voix à la communauté autour d'un artiste, **sans modération lourde** :

- les mélomanes réagissent à un artiste (sortie, concert, souvenir) ;
- l'artiste revendiqué répond et anime sa communauté ;
- ça crée de l'engagement mesurable (badge « réactif », stats) et du contenu
  frais sur chaque profil (SEO bonus).

Règle d'or : **simple à lire, facile à modérer, impossible à spammer**.

---

## 3. UX / parcours

### Lecture (tous, non connectés inclus)
- Onglet **« Mur »** dans la fiche artiste (web `ArtistSheet` + page
  `/artist/:id`, mobile `ArtistSheet`).
- Fil chronologique (plus récent d'abord), avatar + nom + horodatage relatif
  (« il y a 2 h »), message (2 000 caractères max), 1 seul niveau de
  profondeur (pas de threads imbriqués — les réponses d'artiste sont épinglées
  en haut du fil).
- Badge « Artiste » / « Vérifié » à côté du nom de l'auteur quand c'est
  l'artiste ou un compte vérifié.

### Écriture (connecté uniquement)
- Champ de saisie en bas de l'onglet, **bouton discret** (pas d'envoi au
  Enter involontaire).
- **Limite de 5 messages / heure** (anti-spam), 1 message max par profil par
  jour pour les comptes gratuits — les abonnés `premium` voient la limite
  levée (argument de vente).
- Émoticônes et liens : les **liens sont désactivés** (texte affiché brut,
  non cliquable) sauf pour les comptes vérifiés/artiste — anti-arnaques.

### Modération (admin)
- Onglet admin « Mur » : liste des messages signalés + tous les messages,
  filtres (artiste, signalé, récent).
- Actions : masquer, supprimer, bannir l'auteur (mise au ban temporaire de
  l'écriture, 3 signalements = ban automatique de 24 h).
- Les utilisateurs peuvent **signaler** un message (bouton discret).

---

## 4. Schéma SQL (proposition)

```sql
-- Mur d'un artiste (messages de la communauté)
CREATE TABLE IF NOT EXISTS public.artist_comments (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  artist_id   TEXT NOT NULL REFERENCES public.map_artists(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body        TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  pinned      BOOLEAN NOT NULL DEFAULT false,        -- réponse artiste épinglée
  hidden      BOOLEAN NOT NULL DEFAULT false,        -- masqué par la modération
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS artist_comments_artist_idx
  ON public.artist_comments (artist_id, created_at DESC);

-- RLS : lecture publique (hors masqués), écriture par le propriétaire
ALTER TABLE public.artist_comments ENABLE ROW LEVEL SECURITY;
-- SELECT : anon + authenticated, WHERE hidden = false
-- INSERT : authenticated + auth.uid() = user_id + limite anti-spam
-- DELETE : modérateurs (is_admin()) uniquement

-- Signalements
CREATE TABLE IF NOT EXISTS public.comment_reports (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  comment_id BIGINT NOT NULL REFERENCES public.artist_comments(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (comment_id, user_id)
);
```

**Anti-spam côté SQL** (dans une fonction `add_artist_comment` SECURITY DEFINER) :
- vérifier `auth.uid()` ;
- compter les messages de l'utilisateur dans la **dernière heure** → ≤ 5 ;
- pour un compte gratuit, compter les messages de l'utilisateur **aujourd'hui**
  sur CE profil → ≤ 1 (sauf si `profiles.account_type = 'premium'`) ;
- banni → rejet.

---

## 5. Intégration avec l'existant

- **Notifications** : nouvelle source `comment` dans la table `notifications`
  (étendre le CHECK) — notifie l'artiste revendiqué via `notify_artist_action`,
  et l'auteur via `notify_comment_reply` quand l'artiste répond. Déjà synchro
  web ⇄ mobile (même table).
- **Gamification** : badges auditeur « premier message sur le mur », « super
  fan » (5 commentaires), et artiste « réactif » (répond sur son mur).
- **Stats** : `artist_stats_detail` peut compter les messages du mur (`comments`)
  et les réactions, affichés dans le dashboard artiste.
- **SEO** : le mur apporte du contenu frais aux pages artiste (intérêt
  secondaire, pas de microdata à ajouter).

---

## 6. Décisions à valider avant développement

1. Nom retenu : **Le Mur / The Wall** ou **Discussions** ?
2. Limite gratuite : 1 message/jour par profil est-il trop restrictif ?
3. Faut-il un système de « réactions » (👍 ❤️ 🎵) en plus du texte ?
   *(Recommandation : non en v1, le like existe déjà — garder le mur texte pur.)*
4. Le bannissement automatique (3 signalements = 24 h) est-il acceptable ?

---

## 7. Périmètre v1 vs v2

| v1 (MVP) | v2 |
|---|---|
| Écrire/lire, épinglage artiste, masquer/supprimer admin | Réactions emoji, @mentions |
| Anti-spam (5/h + 1/jour), signalement | Ban auto, image jointe |
| Notif artiste + auteur | Traduction auto des messages |
| Web + mobile (même table) | Modération IA (détection toxicité) |
