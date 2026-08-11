# Run doc — Musimaps (preview)

## Reproduire les artefacts non commités

- `apps/web/.env.local` — doit exister (copié depuis le checkout principal). Contient
  `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (secrets, jamais commités).
- Dépendances : `npm install` à la racine (npm workspaces `apps/*`).
- Le workspace de preview == checkout principal (`D:\musimaps`), donc aucun autre
  fichier d'environnement n'est requis pour `apps/web`.

## Lancer le serveur (dev web)

- Port préféré : **5199** (défaut de preview de ce thread). Vérifier qu'il est libre
  (`netstat -ano | grep ":5199"`), sinon adapter `--port`.
- Commande :

```bash
cd apps/web
npx vite --port 5199 --strictPort
```

- Log de preview attendu : `.freebuff/preview-*.log` (redirection `2>&1`).
- URL de preview : `http://localhost:5199/` (admin : `/admin`, carte : `/globe`).
- Arrêt : tuer le PID `node` écoutant sur 5199.

## Notes

- Ne pas utiliser `npm run dev` du monorepo racine (pas de port garanti) ; lancer
  `vite` directement dans `apps/web` avec `--strictPort`.
