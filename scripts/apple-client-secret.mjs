#!/usr/bin/env node
/**
 * Génère le « Secret Key (for OAuth) » de Sign in with Apple pour le web,
 * à coller dans Supabase → Authentication → Providers → Apple.
 *
 * Apple n'accepte pas de secret fixe : c'est un JWT signé avec la clé
 * « Sign in with Apple » (.p8) du compte développeur, valable 6 mois au plus.
 * Il faut donc relancer ce script et recoller le résultat avant expiration,
 * sinon la connexion Apple s'arrête sur le web (l'app iOS, native, n'en
 * dépend pas).
 *
 * La clé .p8 ne doit jamais entrer dans le dépôt : gardez-la à part
 * (ex. ../musimaps-play/apple/).
 *
 * Usage :
 *   node scripts/apple-client-secret.mjs --key ../musimaps-play/apple/AuthKey_XXXX.p8 \
 *     --key-id XXXX --team YYYY --client com.musimaps.web
 */
import { createPrivateKey, sign } from 'node:crypto'
import { readFileSync } from 'node:fs'

/** Durée maximale admise par Apple : 6 mois (15 777 000 s). */
const MAX_LIFETIME_S = 15_777_000

function arg(name) {
  const index = process.argv.indexOf(`--${name}`)
  return index > -1 ? process.argv[index + 1] : undefined
}

const keyPath = arg('key')
const keyId = arg('key-id')
const teamId = arg('team')
const clientId = arg('client') ?? 'com.musimaps.web'
if (!keyPath || !keyId || !teamId) {
  console.error('Usage : node scripts/apple-client-secret.mjs --key AuthKey_XXXX.p8 --key-id XXXX --team YYYY [--client com.musimaps.web]')
  process.exit(1)
}

const base64url = (value) => Buffer.from(value).toString('base64url')
const now = Math.floor(Date.now() / 1000)
const header = { alg: 'ES256', kid: keyId }
const payload = { iss: teamId, iat: now, exp: now + MAX_LIFETIME_S, aud: 'https://appleid.apple.com', sub: clientId }
const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`
// ES256 au format JWT : signature brute r||s (et non DER).
const signature = sign('sha256', Buffer.from(unsigned), {
  key: createPrivateKey(readFileSync(keyPath)),
  dsaEncoding: 'ieee-p1363',
})

console.log(`${unsigned}.${signature.toString('base64url')}`)
console.error(`\nValable jusqu'au ${new Date((now + MAX_LIFETIME_S) * 1000).toLocaleDateString('fr-FR')} — à régénérer avant cette date.`)
