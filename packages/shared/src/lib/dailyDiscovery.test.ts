import { describe, expect, it } from 'vitest'
import { DAILY_DISCOVERY_HOUR, dayKeyOf, nextDailySlots, pickDailyArtists } from './dailyDiscovery'

const COTONOU: [number, number] = [2.4183, 6.3654]
const PORTO_NOVO: [number, number] = [2.6036, 6.4969] // ~25 km
const PARAKOU: [number, number] = [2.6286, 9.3372] // Bénin, ~330 km
const LAGOS: [number, number] = [3.3792, 6.5244] // Nigeria

const artists = [
  { id: 'cotonou-1', city: 'Cotonou', country: 'Bénin', coordinates: COTONOU },
  { id: 'cotonou-2', city: 'Cotonou', country: 'Bénin', coordinates: COTONOU },
  { id: 'porto-novo', city: 'Porto-Novo', country: 'Bénin', coordinates: PORTO_NOVO },
  { id: 'parakou', city: 'Parakou', country: 'Bénin', coordinates: PARAKOU },
  { id: 'lagos', city: 'Lagos', country: 'Nigeria', coordinates: LAGOS },
]

describe('pickDailyArtists', () => {
  it('propose les proches, puis le pays, puis le reste', () => {
    const picked = pickDailyArtists(artists, { coordinates: COTONOU, countryCode: 'BJ' }, { dayKey: '2026-10-26', count: 5 })
    expect(picked.slice(0, 3).map((a) => a.id).sort()).toEqual(['cotonou-1', 'cotonou-2', 'porto-novo'])
    expect(picked[3].id).toBe('parakou')
    expect(picked[4].id).toBe('lagos')
  })

  it('écarte les favoris et les artistes déjà proposés', () => {
    const picked = pickDailyArtists(artists, { coordinates: COTONOU, countryCode: 'BJ' }, {
      dayKey: '2026-10-26', count: 5, exclude: ['cotonou-1', 'porto-novo'],
    })
    expect(picked.map((a) => a.id)).not.toContain('cotonou-1')
    expect(picked.map((a) => a.id)).not.toContain('porto-novo')
    expect(picked).toHaveLength(3)
  })

  it('reste stable pour un même jour', () => {
    const a = pickDailyArtists(artists, null, { dayKey: '2026-10-26', count: 5 })
    const b = pickDailyArtists(artists, null, { dayKey: '2026-10-26', count: 5 })
    expect(a.map((x) => x.id)).toEqual(b.map((x) => x.id))
    expect(new Set(a.map((x) => x.id)).size).toBe(5)
  })
})

describe('nextDailySlots', () => {
  it("commence aujourd'hui si l'heure n'est pas passée, demain sinon", () => {
    const morning = new Date(2026, 9, 26, 9, 0)
    expect(nextDailySlots(morning, 2).map(dayKeyOf)).toEqual(['2026-10-26', '2026-10-27'])
    const evening = new Date(2026, 9, 26, 20, 0)
    const slots = nextDailySlots(evening, 2)
    expect(slots.map(dayKeyOf)).toEqual(['2026-10-27', '2026-10-28'])
    expect(slots[0].getHours()).toBe(DAILY_DISCOVERY_HOUR)
  })
})
