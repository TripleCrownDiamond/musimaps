# Musimaps — Implémentation IA (guide concret)

Guide d'exécution pour les briques IA du roadmap (voir `FEATURES-ROADMAP.md` §3).
Chaque brique est autonome et s'appuie sur l'existant (Supabase, RPC, cron).

---

## 1. Prérequis communs

- **Clé LLM côté serveur uniquement** : dans les *secrets* des edge functions
  Supabase (`supabase secrets set OPENAI_API_KEY=...`) ou dans `VITE_*` jamais.
  Le client (web/mobile) n'a aucune clé.
- **pgvector** : activé par défaut sur Supabase. Une migration ajoute la
  colonne `embedding` et l'index HNSW :
  ```sql
  CREATE EXTENSION IF NOT EXISTS vector;
  ALTER TABLE map_artists ADD COLUMN IF NOT EXISTS embedding vector(1536);
  CREATE INDEX IF NOT EXISTS map_artists_embedding_idx
    ON map_artists USING hnsw (embedding vector_cosine_ops);
  ```

---

## 2. Brique A+B — Enrichissement & résumé de bio (edge function)

Une **edge function** unique `ai_enrich` traite un artiste : consolide la bio
(court résumé dans la langue demandée), normalise les genres, valide les liens.

`supabase/functions/ai_enrich/index.ts` (esquisse) :

```ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const LLM = "https://api.openai.com/v1/chat/completions"
const KEY  = Deno.env.get("OPENAI_API_KEY")!

serve(async (req) => {
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!,
                                Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
  const { artist_id } = await req.json()

  // 1. Charger l'artiste
  const { data: artist } = await supabase
    .from("map_artists").select("*").eq("id", artist_id).single()
  if (!artist) return new Response("not found", { status: 404 })

  // 2. Résumé de bio + genres normalisés via LLM
  const r = await fetch(LLM, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{
        role: "user",
        content: `Résume en 2 phrases max (200 caractères) le musicien ${artist.name}.
Bio brute : ${artist.bio}
Genres bruts : ${artist.genre}
Réponds en JSON {"bio": "...", "genres": ["..."]}. N'invente rien.`
      }],
      response_format: { type: "json_object" },
    }),
  })
  const { bio, genres } = (await r.json()).choices[0].message.content

  // 3. Écrire (ne jamais écraser un nom/une bio curés : RPC add_or_update garde le nom)
  await supabase.from("map_artists").update({ bio, genre: genres.join(", ") })
                .eq("id", artist_id).eq("claimed_by", null) // profil non revendiqué
  return new Response("ok")
})
```

**Déclenchement** : appelé par le cron `populate-map` (option `--ai`) ou par un
traitement en lot le soir : `for id in ids; curl -X POST .../ai_enrich`.

---

## 3. Brique C — Déduplication (suggestions admin)

1. Générer les embeddings des artistes (job hebdo) :
   ```ts
   const emb = await openai.embeddings.create({ model: "text-embedding-3-small",
     input: `${artist.name} ${artist.genre} ${artist.city}` })
   ```
   stockés dans `map_artists.embedding`.
2. RPC de similarité :
   ```sql
   CREATE OR REPLACE FUNCTION suggest_merges(min_sim float DEFAULT 0.88)
   RETURNS TABLE (a text, b text, sim float) LANGUAGE sql STABLE AS $$
     SELECT a.id, b.id, 1 - (a.embedding <=> b.embedding)
     FROM map_artists a, map_artists b
     WHERE a.id < b.id
       AND a.embedding IS NOT NULL AND b.embedding IS NOT NULL
       AND (a.name = b.name OR 1 - (a.embedding <=> b.embedding) > min_sim)
     ORDER BY 3 DESC LIMIT 50;
   $$;
   ```
3. Admin : page « Fusions suggérées » (liste + boutons Approuver / Rejeter →
   table `artist_merges`). L'approbation merge les stats/abonnés puis supprime
   le doublon.

---

## 4. Brique E — Recherche sémantique + Découvertes

- Backfill embeddings (script `scripts/embed-artists.mjs`, s'inspire de
  `populate-map.mjs` : même structure, clé API server-side).
- RPC `match_artists(query_embedding, match_count)` (SQL du roadmap §5) exposé
  en REST → le web et le mobile appellent `/rest/v1/rpc/match_artists` avec un
  embedding calculé **côté serveur** (endpoint `ai_search`), jamais côté client.
- Fil « Découvertes » : `match_artists` sur l'embedding moyen des genres suivis,
  en excluant `follows` existants.

---

## 5. Brique F — Chatbot assistant

- Widget flottant web + écran mobile.
- Backend : endpoint Vercel (`/api/chat`) avec **Vercel AI SDK** + pgvector :
  l'utilisateur pose une question → embedding de la question → `match_artists`
  → le LLM répond **à partir de ces vrais résultats** (RAG, prompt : « Tu
  réponds uniquement à partir de ces artistes réels ») → streaming.
- Actions proposées dans les réponses : « Suivre », « Voir le profil »,
  « Demander un booking » (liens profonds existants).

---

## 6. Brique D — Modération

- Edge function `ai_moderate` : `{ type: "bio" | "booking" | "comment", text }`
  → verdict `ok | review | reject` + raison en 1 ligne.
- L'admin `BookingsPage` / édition bio affiche un badge « ⚠ à vérifier » quand
  le verdict est `review`, et bloque le `reject`.
- Logging : table `moderation_logs(id, type, text_hash, verdict, reason, at)`.

---

## 7. Coûts indicatifs (mini-modèles)

| Usage | Volume estimé | Coût |
|---|---|---|
| Enrichissement bio (A+B) | ~20 artistes/jour × 1 000 tokens | < 0,01 $/jour |
| Embeddings (C+E) | 50 000 artistes × 1536 dims | < 0,05 $ (one-shot) |
| Chatbot (F) | 1 000 messages/mois × 500 tokens | ~1-3 $/mois |

L'ensemble reste sous ~5 $/mois au stade actuel — le coût n'est pas un
bloqueur ; la **clé sécurisée côté serveur** et le **volume** le sont.

---

## 8. Agent IA Musimaps (Mistral) — EN PLACE ✅

### 8.1 Agent à outils (pattern LangGraph) `scripts/lib/ai-agent.mjs`

Un vrai agent à outils : **état + outils + boucle de décision** (le pattern
que LangGraph formalise, sans la dépendance — portable Node **et** Deno).
Pour un artiste il enchaîne : `musicbrainz_search` → `musicbrainz_details`
→ `wikidata_entity` (occupations P106, **anti-politicien**) →
`wikipedia_summary` (bio + photo HD) → `geocode` (Mapbox) → **verdict
Mistral** (`keep`/`review`/`reject` + genre + bio FR). Boucle bornée par
`maxSteps`, chaque manque (pays, ville, bio, image, vérification) déclenche
l'outil qui le comble.

Scripts : `scripts/ai-artist-agent.mjs` (`--artist` = agent complet,
`--map` = audit de la carte, `--city` = peuplement) et `populate-map.mjs
--ai --agent` (vérification + deep-search des candidats sans bio/photo).
Clé `MISTRAL_API_KEY` dans le `.env` racine — jamais côté client.

Verdict par artiste : `keep` / `review` / `reject`, avec genre normalisé et
bio française courte. Aucune suppression auto : les `reject` sont listés
pour validation par l'admin.

```bash
node scripts/ai-artist-agent.mjs --artist "Booba"        # deep-search + verdict
node scripts/ai-artist-agent.mjs --map --dry-run         # audit simulé
node scripts/ai-artist-agent.mjs --map                   # audit + corrections genre/bio
node scripts/ai-artist-agent.mjs --city "Lagos"          # peuplement vérifié par l'IA
```

- `--map` : corrige genre/bio via le RPC `add_or_update_map_artist`, écrit
  `.freebuff/ai-agent-report.json` (listes `review`/`reject` pour l'admin).
- `--city` délègue à `populate-map.mjs --ai` : chaque candidat est vérifié
  par Mistral AVANT d'être ajouté (rejet des homonymies, labels, profils
  techniques).
- Exemple réel : 173 artistes audités → 134 corrigés, 22 non-musiciens
  supposés signalés (dont des erreurs de localisation : « Disoul » placé à
  Dakar alors que groupe canadien, « Timi Dakolo » géolocalisé au Ghana…).

### 8.2 Edge functions (prod Supabase)

- **`ai_verify`** — vérifie les candidats de la recherche (Mistral) :
  filtrage anti-politiciens, genre/bio normalisés.
- **`ai_artist_agent`** — l'agent à outils complet exécuté côté serveur
  (deep-search + géocodage + verdict). Le web l'appelle en repli quand la
  recherche de base est mince (peu de résultats ou sans vraie bio).

Les deux ont une **dégradation silencieuse** côté client (timeout 6-9 s,
résultats bruts conservés) et une **garde anti-abus** (en-tête `apikey`
comparée à la clé anon du projet). Déploiement (une fois) :
```bash
npx supabase functions deploy ai_verify
npx supabase functions deploy ai_artist_agent
npx supabase secrets set MISTRAL_API_KEY=xxx MAPBOX_TOKEN=xxx
```

### 8.3 Carte — dés-empilement des pins

Les localisations étant des géocodages de ville (pas précises à la rue
près), des artistes d'une même ville seraient parfaitement empilés. Niveaux
de zoom : **Monde → Pays → Ville → sous-groupe ~2 km → pins individuels**
(web `GlobeMap.tsx` + mobile `ExploreScreen.tsx`). Les pins qui partagent la
même position sont écartés en **spirale déterministe** (stable entre rendus)
; en zoom intermédiaire un sous-cluster compact ×N évite la surcharge.

## 9. Briques suivantes (non implémentées)

1. Migration `pgvector` + RPC `match_artists` (recherche sémantique).
2. `embed-artists.mjs` + backfill embeddings.
3. Page admin « Fusions suggérées » (dédoublonnage par embeddings).
4. Fil « Découvertes » web + mobile (match par genres suivis).
5. Chatbot assistant (Vercel AI SDK + RAG sur `match_artists`).
6. Modération IA des bios/bookings (`ai_moderate`).
7. Déploiement de l'edge function `ai_verify` (cf. §8.2).
