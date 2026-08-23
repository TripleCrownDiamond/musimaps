# Envoi d'emails — SMTP Hostinger (noreply@musimaps.com)

Tout l'envoi de mails passe par la boîte **noreply@musimaps.com** hébergée chez
Hostinger (SMTP `smtp.hostinger.com`).

## Configuration déjà en place (racine `.env` — gitignoré)

```
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USER=noreply@musimaps.com
SMTP_PASS=…
MAIL_FROM=noreply@musimaps.com
MAIL_FROM_NAME=Musimaps
```

Vérifié : authentification SMTP **OK** et envoi de test **réussi** (messageId accepté).

## Script d'envoi (emails transactionnels)

`scripts/send-email.mjs` envoie un email depuis la ligne de commande / cron :

```bash
node scripts/send-email.mjs --to "fan@example.com" \
  --subject "Votre demande de réservation" \
  --html "<h2>Demande envoyée</h2><p>L'artiste a bien reçu votre demande.</p>"
```

Options : `--to` (obligatoire), `--subject` (obligatoire), `--text`, `--html`,
`--file body.html` (corps depuis un fichier, texte auto-extrait du HTML).

**Cron quotidien** (ex. relance waitlist, digest) :
`0 9 * * * cd /d/musimaps && node scripts/send-email.mjs --to …`

## Emails d'authentification (confirmation, reset, magic link)

Les emails d'auth (confirmation d'inscription, réinitialisation de mot de passe)
sont générés par **Supabase Auth**. Pour qu'ils partent de `noreply@musimaps.com`
via Hostinger, activer le **Custom SMTP** dans le dashboard Supabase
(il ne peut pas être réglé depuis la base) :

1. Supabase → **Authentication** → **Emails** (ou *Email Templates*).
2. Section **SMTP Settings** → activer *Enable Custom SMTP*.
3. Renseigner :
   - **Host** : `smtp.hostinger.com`
   - **Port** : `465`
   - **Username** : `noreply@musimaps.com`
   - **Password** : le mot de passe de la boîte (`.env` → `SMTP_PASS`)
   - **Sender name** : `Musimaps`
   - **Sender email** : `noreply@musimaps.com`
4. Enregistrer puis **envoyer l'email de test** proposé par le dashboard.

Une fois activé, les templates (Confirmation, Invite, Reset, Magic Link) partent
avec le logo/texte édités dans *Email Templates*, expédiés via Hostinger.

## Points d'accroche possibles (emails métier)

Les notifications *in-app* (réservations, suivis) existent déjà. Pour les doubler
en email :

- **Réservation reçue** : après `request_booking` OK → appel à
  `scripts/send-email.mjs` (ou une edge function Supabase avec les mêmes
  variables SMTP) vers l'email de l'artiste.
- **Statut de réservation** : après `notify_booking_status` → email au demandeur.
- **Waitlist** : au passage en ligne ou aux newsletters → email aux inscrits.

Une edge function (`supabase/functions/`) est la meilleure option pour un envoi
synchrone depuis le client ; le script suffit pour des envois par lots (cron).
