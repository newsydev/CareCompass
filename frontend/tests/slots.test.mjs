import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const source = ts.transpileModule(
  readFileSync(new URL('../src/utils/slots.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.ESNext } },
).outputText
const { bookingSlots, formatSlot } = await import(`data:text/javascript,${encodeURIComponent(source)}`)

test('slots start at next availability and stay inside the window', () => {
  const slots = bookingSlots('2026-01-15T16:30+05:30', '09:00', '18:00')
  assert.equal(slots[0], '2026-01-15T16:30+05:30')
  assert.ok(slots.includes('2026-01-15T17:30+05:30'))
  assert.ok(!slots.includes('2026-01-15T18:00+05:30'))
  assert.ok(slots.includes('2026-01-16T09:00+05:30'))
  assert.ok(slots.every((slot) => slot.endsWith('+05:30')))
})

test('next-day rollover crosses month boundaries', () => {
  const slots = bookingSlots('2026-01-31T20:00+05:30', '08:00', '20:30')
  assert.deepEqual(slots.slice(0, 2), ['2026-01-31T20:00+05:30', '2026-02-01T08:00+05:30'])
})

test('formatSlot renders IST regardless of host timezone', () => {
  assert.match(formatSlot('2026-01-15T16:30+05:30'), /4:30/)
})
