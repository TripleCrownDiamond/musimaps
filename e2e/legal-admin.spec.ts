import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

// A local, synthetic admin session. All auth/database requests are intercepted;
// saving and publishing below change only this test's in-memory fixture.
let supabaseUrl = process.env.VITE_SUPABASE_URL
try {
  supabaseUrl ||= readFileSync('apps/web/.env.local', 'utf8').match(/^VITE_SUPABASE_URL=["']?([^\s"']+)/m)?.[1]
} catch { /* CI can supply VITE_SUPABASE_URL */ }

test('admin edits, saves and publishes bilingual legal fields without touching live data', async ({ page }) => {
  test.skip(!supabaseUrl, 'A configured web build is needed to exercise the CMS adapter')
  const email = 'legal-qa@example.invalid'
  const user = { id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated', email, user_metadata: {} }
  const expiresAt = Math.floor(Date.now() / 1000) + 3600
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, exp: expiresAt, role: 'authenticated' })}.test-only`
  const storageKey = `sb-${new URL(supabaseUrl!).hostname.split('.')[0]}-auth-token`
  await page.addInitScript(({ storageKey, session }) => {
    localStorage.setItem(storageKey, JSON.stringify(session))
    localStorage.setItem('musimaps.theme', 'light')
  }, { storageKey, session: { access_token: token, refresh_token: 'test-only', expires_at: expiresAt, expires_in: 3600, token_type: 'bearer', user } })
  await page.route('**/auth/v1/**', (route) => route.fulfill({ json: user }))
  const row: Record<string, any> = {
    key: 'settings', content: { launchDate: '2026-08-19T12:00:00Z', llm: { enabled: false, provider: 'mistral', model: 'test-model', maxSteps: 3 } },
    content_en: {}, draft: null, draft_en: null, published_at: null,
  }
  let published = 0
  await page.route('**/rest/v1/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const resource = url.pathname.split('/').pop()
    const single = request.headers().accept?.includes('vnd.pgrst.object')
    if (resource === 'site_content' && request.method() === 'POST') {
      Object.assign(row, request.postDataJSON())
      return route.fulfill({ json: null })
    }
    if (resource === 'publish_section') {
      published++
      row.content = structuredClone(row.draft)
      row.published_at = new Date().toISOString()
      return route.fulfill({ json: { ok: true } })
    }
    // Block all unexpected mutations, including bootstrap, check-in and profile sync.
    if (request.method() !== 'GET') return route.fulfill({ status: 403, json: { message: 'Mutation blocked in local QA' } })
    if (resource === 'admins') return route.fulfill({ json: single ? { email } : [{ email }] })
    if (resource === 'profiles') return route.fulfill({ json: { id: user.id, email, display_name: 'Compte de test', role: 'melomane', account_type: 'personal' } })
    if (resource === 'site_content') return route.fulfill({ json: single ? row : [row] })
    if (resource === 'site_content_public') return route.fulfill({ json: [{ key: 'settings', content: row.content, content_en: row.content_en }] })
    return route.fulfill({ json: single ? null : [] })
  })

  await page.goto('/admin/settings')
  const fields = page.locator('#legal')
  await expect(fields).toBeVisible()
  await fields.getByLabel('Nom officiel de l’éditeur', { exact: true }).fill('Éditeur de test')
  await page.getByRole('button', { name: 'Enregistrer le brouillon', exact: true }).click()
  await expect.poll(() => row.draft?.legal?.publisherName).toBe('Éditeur de test')
  expect(row.content.legal).toBeUndefined()
  await page.getByRole('button', { name: 'Publier', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Publier', exact: true }).click()
  await expect(page.getByText('Publication impossible', { exact: true })).toBeVisible()
  expect(published).toBe(0)

  await fields.getByLabel('E-mail de contact et de demande de suppression', { exact: true }).fill('contact@example.invalid')
  for (const title of ['Politique de confidentialité', 'Conditions d’utilisation', 'Suppression du compte et des données']) {
    await fields.getByLabel(new RegExp(`${title} — Français`)).fill(`${title} : texte FR de test.`)
    await fields.getByLabel(new RegExp(`${title} — English`)).fill(`${title} : EN test text.`)
  }
  // Publishing must also save edits that were not manually saved a second time.
  await page.getByRole('button', { name: 'Publier', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Publier', exact: true }).click()
  await expect.poll(() => published).toBe(1)
  expect(row.content.llm.model).toBe('test-model')
  await page.goto('/en/confidentialite')
  await expect(page.getByTestId('legal-document')).toContainText('EN test text.')
  await page.goto('/admin/settings')
  await expect(page.locator('#legal').getByLabel('Nom officiel de l’éditeur', { exact: true })).toHaveValue('Éditeur de test')
})
