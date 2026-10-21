import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { REPORT_DETAILS_MAX, REPORT_REASONS, withoutBlocked } from './moderation'

describe('modération des fiches', () => {
  it('retire les artistes bloqués, et rien d’autre', () => {
    const artists = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    expect(withoutBlocked(artists, ['b'])).toEqual([{ id: 'a' }, { id: 'c' }])
    expect(withoutBlocked(artists, [])).toBe(artists)
  })

  it('garde les mêmes motifs et la même borne que la contrainte SQL', () => {
    const sql = readFileSync(new URL('../../../../supabase/migrations/00077_content_reports_and_blocks.sql', import.meta.url), 'utf8')
    for (const reason of REPORT_REASONS) expect(sql).toContain(`'${reason}'`)
    expect(sql).toContain(`char_length(details) <= ${REPORT_DETAILS_MAX}`)
  })
})
