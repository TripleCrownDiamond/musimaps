# Peuplement automatique de la carte (MusicBrainz)

`scripts/populate-map.mjs` moissonne MusicBrainz ville par ville, vérifie que
chaque candidat est bien un **musicien** (Wikidata, anti-politiciens/acteurs),
récupère une **vraie bio + photo HD** (Wikipedia, priorité au QID Wikidata puis
titre exact puis recherche en/fr), géocode la ville (Mapbox) et **upsert** via
le RPC `add_or_update_map_artist` — qui déclenche aussi `notify_discovery`.

## Utilisation

```bash
npm run populate:map                        # 25 villes par défaut, 15 max/ville
npm run populate:map -- --city Paris        # une ville précise
npm run populate:map -- --cities "Lagos,Abidjan,Dakar"
npm run populate:map -- --limit 25          # max par ville
npm run populate:map -- --batch 100         # arrêt après 100 ajouts au total
npm run populate:map -- --dry-run           # simulation (aucune écriture)
npm run populate:map -- --refresh-updates   # re-traiter les MBID déjà vus (mise à jour forcée)
npm run populate:map -- --keep-unverified   # garder les artistes sans page Wikidata
npm run populate:map -- --reset-state       # repartir de zéro (état + dédupe effacés)
```

### Configuration

- `apps/web/.env.local` doit contenir `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
  et `VITE_MAPBOX_TOKEN`.
- Aucune clé service requise : l'écriture passe par le RPC public.

### État & reprise

L'avancement est persisté dans `.freebuff/populate-map-state.json` (historique
par ville + MBID déjà insérés).

- **Tous les runs re-parcourent toutes les villes** (peuplement périodique) ;
  la dédupe par MBID évite les doublons et les artistes déjà présents sont
  simplement **mis à jour** (bio, genre, image) sans être réajoutés.
- `--batch N` limite **chaque exécution** à N nouveaux ajouts (utile pour cron).
- `--refresh-updates` re-traite aussi les MBID déjà vus (force l'upsert).
- Le RPC préserve le **nom curé** : un nom corrigé par l'admin/l'artiste
  n'est jamais écrasé par le cron.

## Cron

Périodicité conseillée : chaque nuit, hors pic d'usage MusicBrainz.

```cron
# Exemple : chaque nuit à 03:10, 60 ajouts max, journalisé
10 3 * * * cd /d/musimaps && npm run populate:map -- --batch 60 >> logs/populate.log 2>&1
```

Sous Linux/macOS, adapter le chemin. Sous Windows, utiliser le Planificateur de
tâches avec `cmd /c "cd /d D:\musimaps && npm run populate:map -- --batch 60"`.

## Qualité

- **Filtre musicien** : occupation Wikidata (P106) — chanteur, rappeur, DJ,
  compositeur… Les politiciens/acteurs/sportifs sont rejetés.
- **Notoriété** : les candidats sont classés (lien Wikidata +6, genres +3,
  date de début +2, nom propre +1) ; les noms à numéros (démos) sont dépriorisés.
- **Bio/image** : QID Wikidata → titre enwiki exact ; sinon titre direct ;
  sinon recherche en/fr **à titre correspondant** (jamais de label/festival).
- Sans lien Wikidata, l'artiste est ignoré par défaut (`--keep-unverified` pour
  les scènes locales sans page Wikipedia).
