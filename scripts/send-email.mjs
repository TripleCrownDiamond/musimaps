#!/usr/bin/env node
/**
 * Envoi d'emails transactionnels via le SMTP Hostinger (noreply@musimaps.com).
 *
 * Lit la configuration depuis `.env` (racine) :
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM, MAIL_FROM_NAME
 *
 * Usage :
 *   node scripts/send-email.mjs --to "fan@example.com" \
 *     --subject "Votre demande de réservation" \
 *     --text "Bonjour, votre demande a été envoyée à l'artiste."
 *   node scripts/send-email.mjs --to "x@y.com" --subject "S" --html "<b>Hi</b>" --file body.html
 *
 * Idéal pour : confirmations de réservation, alertes booking, digest, waitlist.
 * Peut être appelé depuis un cron :  0 9 * * * cd /d/musimaps && node scripts/send-email.mjs ...
 */
import nodemailer from 'nodemailer'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function loadEnv(file) {
  const out = {}
  if (!existsSync(file)) return out
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return out
}

function arg(name) {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const env = loadEnv(path.join(root, '.env'))
const to = arg('--to')
const subject = arg('--subject')
const file = arg('--file')

if (!to || !subject) {
  console.error('Usage : node scripts/send-email.mjs --to email [--subject "..."] [--text "..."] [--html "..."] [--file body.html]')
  process.exit(1)
}
if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
  console.error('Manquant : SMTP_HOST / SMTP_USER / SMTP_PASS dans .env (racine).')
  process.exit(1)
}

let html = arg('--html')
let text = arg('--text')
if (file) {
  const content = readFileSync(path.resolve(root, file), 'utf8')
  html = html ?? content
  text = text ?? content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}
if (!html && !text) text = subject

const transport = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: Number(env.SMTP_PORT ?? 465),
  secure: String(env.SMTP_PORT ?? '465') === '465',
  auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  tls: { rejectUnauthorized: false },
})

const result = await transport.sendMail({
  from: `"${env.MAIL_FROM_NAME ?? 'Musimaps'}" <${env.MAIL_FROM ?? env.SMTP_USER}>`,
  to,
  subject,
  text,
  html,
})

console.log(`✅ Email envoyé à ${to} — messageId ${result.messageId}`)
await transport.close()
