# Sauvegardes de la base, hors de Supabase

Le plan gratuit de Supabase ne fait **aucune** sauvegarde automatique. Deux moyens :

| | Quand | Où |
|---|---|---|
| `npm run db:backup` | à la main, depuis le Mac (Docker requis) | `../musimaps-play/sauvegardes/supabase-AAAA-MM-JJ/` |
| GitHub Actions | chaque nuit, tout seul | artefacts du dépôt **privé** `musimaps-sauvegardes`, chiffrés, 14 jours |

Contenu d'une sauvegarde : `base.dump` (toute la base : public, auth, storage…), `base.sql` (la même
chose en SQL lisible), `fichiers/` (tout le stockage, par bucket).

⚠️ Données personnelles (e-mails, mots de passe chiffrés) : jamais dans le dépôt public, jamais
partagées.

## Mise en place de la sauvegarde automatique (une fois)

1. Dépôt privé `musimaps-sauvegardes` contenant `scripts/backup/github-workflow.yml` copié en
   `.github/workflows/sauvegarde.yml`.
2. Quatre secrets dans ce dépôt (Settings → Secrets and variables → Actions) :
   `DATABASE_PASSWORD`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `BACKUP_PASSPHRASE`.
3. **Noter `BACKUP_PASSPHRASE` ailleurs** (gestionnaire de mots de passe) : sans elle, les
   archives sont illisibles, pour vous comme pour un intrus.
4. Onglet Actions → « Sauvegarde Supabase » → *Run workflow* pour un premier essai.

Un échec (mot de passe changé, Supabase en pause…) déclenche un e-mail de GitHub.

## Restaurer

```bash
# 1. Télécharger l'archive (onglet Actions → l'exécution voulue → Artifacts), puis :
gpg -d musimaps-AAAA-MM-JJ.tar.gz.gpg | tar -xz        # demande BACKUP_PASSPHRASE
# 2. Vers un Postgres vide (nouveau projet Supabase, ou local pour vérifier) :
pg_restore --no-owner --no-privileges -d "<URL de la base cible>" supabase/base.dump
```

Les fichiers du stockage (`supabase/fichiers/<bucket>/…`) se renvoient ensuite dans les buckets
du même nom.

Tester une restauration de temps en temps (base locale jetable) : une sauvegarde jamais relue
n'est pas une sauvegarde.
