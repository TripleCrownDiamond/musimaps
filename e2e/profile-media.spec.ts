import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { PROFILE_MEDIA } from '../packages/shared/src/design/profile-media'

let supabaseUrl = process.env.VITE_SUPABASE_URL
try {
  supabaseUrl ||= readFileSync('apps/web/.env.local', 'utf8').match(/^VITE_SUPABASE_URL=["']?([^\s"']+)/m)?.[1]
} catch { /* CI supplies VITE_SUPABASE_URL */ }

// Synthetic account: every database request is intercepted, including writes.
// Expo Web is opt-in because its development server is not part of web CI.
for (const surface of ['web', 'expo'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    test(`${surface}: the only profile media is the avatar in ${theme} mode`, async ({ page }, testInfo) => {
      test.skip(!supabaseUrl || (surface === 'expo' && !process.env.EXPO_QA_URL))
      const english = theme === 'dark'
      const email = 'profile-qa@example.invalid'
      const user = { id: '00000000-0000-4000-8000-000000000002', email, aud: 'authenticated', role: 'authenticated', user_metadata: {} }
      const expiresAt = Math.floor(Date.now() / 1000) + 3600
      const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
      const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, exp: expiresAt, role: 'authenticated' })}.test-only`
      const storageKey = `sb-${new URL(supabaseUrl!).hostname.split('.')[0]}-auth-token`
      const origin = surface === 'expo' ? process.env.EXPO_QA_URL! : 'http://localhost:4173'
      const profile = {
        id: user.id, email, display_name: 'Compte Test', role: 'melomane', account_type: 'personal',
        city: 'Cotonou', country: 'Bénin', favorite_genres: [],
        avatar_url: `${origin}/qa-media/avatar.png`,
      }
      await page.addInitScript(({ storageKey, session, theme, english }) => {
        localStorage.setItem(storageKey, JSON.stringify(session))
        localStorage.setItem('musimaps.theme', theme)
        localStorage.setItem('musimaps.mobile.theme', theme)
        localStorage.setItem('musimaps.mobile.onboarded', 'true')
        localStorage.setItem('musimaps.mobile.lang-pref', english ? 'en' : 'fr')
        localStorage.setItem('musimaps.mobile.profile', JSON.stringify({ displayName: 'Compte Test', city: 'Cotonou', country: 'Bénin', district: '', bio: '', favoriteGenres: [] }))
      }, { storageKey, theme, english, session: { access_token: token, refresh_token: 'test-only', expires_at: expiresAt, expires_in: 3600, token_type: 'bearer', user } })
      await page.route('**/auth/v1/**', route => route.fulfill({ json: user }))
      await page.route('**/rest/v1/**', route => {
        const request = route.request()
        if (request.method() !== 'GET') return route.fulfill({ status: 403, json: { message: 'Mutation blocked in local QA' } })
        const resource = new URL(request.url()).pathname.split('/').pop()
        if (resource === 'profiles') return route.fulfill({ json: profile })
        return route.fulfill({ json: request.headers().accept?.includes('vnd.pgrst.object') ? null : [] })
      })
      await page.route('**/functions/v1/**', route => route.fulfill({ status: 403, json: { message: 'Blocked in local QA' } }))
      let broken = false
      await page.route('**/qa-media/**', route => broken
        ? route.fulfill({ status: 404, body: '' })
        : route.fulfill({ path: route.request().url().endsWith('.jpg') ? 'apps/mobile/assets/welcome-background.jpg' : 'apps/mobile/assets/brand/icon.png' }))

      const profilePath = surface === 'expo' ? '/Main/Profile' : `${english ? '/en' : ''}/dashboard`
      const editLabel = english ? 'Edit my profile' : 'Modifier mon profil'
      const openProfile = async () => {
        await page.goto(`${origin}${profilePath}`)
        // Native-stack linking deliberately exposes only auth/onboarding links.
        if (surface === 'expo') await page.getByRole('tab', { name: /Profil/ }).click()
      }
      await openProfile()
      // Native-stack retains the profile behind the editor modal.
      const avatar = page.getByTestId('account-avatar').last()
      await expect(avatar).toBeVisible()
      await expect(page.getByTestId('account-cover')).toHaveCount(0)
      const avatarBox = (await avatar.boundingBox())!
      expect(avatarBox.width).toBe(PROFILE_MEDIA.avatarSize.profile)
      expect(avatarBox.height).toBe(PROFILE_MEDIA.avatarSize.profile)
      await expect(avatar.locator('img')).toHaveCount(1)
      if (process.env.PROFILE_QA_SCREENSHOTS) await page.screenshot({ path: testInfo.outputPath('profile.png'), animations: 'disabled', timeout: 10_000 })
      await page.getByRole(surface === 'expo' ? 'button' : 'link', { name: editLabel, exact: true }).first().click()
      await expect(avatar).toHaveCSS('width', `${PROFILE_MEDIA.avatarSize.edit}px`)
      const editAvatar = (await avatar.boundingBox())!
      expect(editAvatar.width).toBe(PROFILE_MEDIA.avatarSize.edit)
      expect(editAvatar.height).toBe(PROFILE_MEDIA.avatarSize.edit)
      if (process.env.PROFILE_QA_SCREENSHOTS) await page.screenshot({ path: testInfo.outputPath('edit.png'), animations: 'disabled', timeout: 10_000 })
      // A failing image must produce a deterministic fallback, never a broken icon.
      broken = true
      profile.avatar_url = `${origin}/qa-media/avatar-broken.png`
      await openProfile()
      await expect(avatar).toContainText('CT')
      await page.getByRole(surface === 'expo' ? 'button' : 'link', { name: editLabel, exact: true }).first().click()
      await expect(avatar).toContainText('CT')
    })
  }
}