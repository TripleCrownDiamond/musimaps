#!/usr/bin/env node
/**
 * Sert le site web construit, pour l'hébergement Node de Hostinger.
 *
 * Hostinger lance `npm start` et attend une application qui écoute sur `PORT`
 * (3000 par défaut). Le site est une application à page unique : toute route
 * inconnue doit rendre `index.html`, sinon un rechargement sur /globe ou
 * /confidentialite renvoie une 404.
 *
 * Aucune dépendance : le module http de Node suffit, et l'hébergeur n'a donc
 * rien de plus à installer.
 */
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, resolve, sep } from 'node:path'

const root = resolve(process.env.WEB_ROOT ?? 'dist')
const port = Number(process.env.PORT ?? 3000)

/** Types servis par le site : le reste tombe sur octet-stream. */
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
}

/** Chemin demandé ramené dans `root` : jamais de remontée hors du dossier. */
function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0])
  const candidate = resolve(join(root, decoded))
  return candidate === root || candidate.startsWith(root + sep) ? candidate : null
}

function send(res, status, file) {
  const type = TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream'
  // Les fichiers de `assets/` portent un hachage dans leur nom : ils ne
  // changent jamais. Le HTML, lui, doit être revalidé à chaque visite, sinon
  // un déploiement reste invisible pour les visiteurs déjà venus.
  const immutable = file.includes(`${sep}assets${sep}`) || file.includes(`${sep}brand${sep}`)
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache, must-revalidate',
  })
  createReadStream(file).pipe(res)
}

const server = createServer((req, res) => {
  const index = join(root, 'index.html')
  const target = safePath(req.url ?? '/')
  if (!target) {
    res.writeHead(400).end('Bad request')
    return
  }
  if (existsSync(target) && statSync(target).isFile()) {
    send(res, 200, target)
    return
  }
  const asDirectory = join(target, 'index.html')
  if (existsSync(asDirectory)) {
    send(res, 200, asDirectory)
    return
  }
  // Route applicative (/globe, /en/cgu…) : l'application la résout elle-même.
  // La version anglaise a son propre index (balise lang et SEO anglais) :
  // servir celui du français y annonçait la mauvaise langue.
  const english = join(root, 'en', 'index.html')
  const isEnglish = /^\/en(\/|$)/.test((req.url ?? '/').split('?')[0])
  const fallback = isEnglish && existsSync(english) ? english : index
  if (existsSync(fallback)) {
    send(res, 200, fallback)
    return
  }
  res.writeHead(500).end('Build introuvable : lancez `npm run build`.')
})

server.listen(port, () => {
  console.log(`Musimaps — site servi depuis ${root} sur le port ${port}`)
})
