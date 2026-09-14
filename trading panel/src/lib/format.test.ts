import { describe, expect, it } from 'vitest'
import { formatDuration } from './format'

describe('formatDuration', () => {
  it('formats minutes only for a short hold', () => {
    const start = '2026-01-01T10:00:00.000Z'
    const now = new Date('2026-01-01T10:20:00.000Z')
    expect(formatDuration(start, now)).toBe('20m')
  })

  it('formats hours and minutes once at least an hour has passed', () => {
    const start = '2026-01-01T10:00:00.000Z'
    const now = new Date('2026-01-01T12:14:00.000Z')
    expect(formatDuration(start, now)).toBe('2h 14m')
  })

  it('formats days and hours once at least a day has passed', () => {
    const start = '2026-01-01T10:00:00.000Z'
    const now = new Date('2026-01-04T15:00:00.000Z')
    expect(formatDuration(start, now)).toBe('3d 5h')
  })

  it('never goes negative if entry time is somehow in the future (clock skew)', () => {
    const start = '2026-01-01T10:00:00.000Z'
    const now = new Date('2026-01-01T09:00:00.000Z')
    expect(formatDuration(start, now)).toBe('0m')
  })
})
