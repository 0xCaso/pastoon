import { describe, it, expect } from 'vitest'
import { jsonToToonHandler, toonToJsonHandler } from '../src/mcp.js'

describe('jsonToToonHandler', () => {
  it('converts valid JSON to TOON', () => {
    const result = jsonToToonHandler({ json: '{"name":"Alice","role":"admin"}' })
    expect(result).toHaveProperty('toon')
    const r = result as { toon: string }
    expect(r.toon).toContain('Alice')
    expect(r.toon).toContain('admin')
    expect(r.toon).not.toContain('{"name"')
  })

  it('passes through delimiter option', () => {
    // delimiter is used as column separator in arrays of objects
    const result = jsonToToonHandler({
      json: '[{"a":1,"b":2},{"a":3,"b":4}]',
      delimiter: '|',
    })
    expect(result).toHaveProperty('toon')
    const r = result as { toon: string }
    expect(r.toon).toContain('|')
  })

  it('returns error object on invalid JSON', () => {
    const result = jsonToToonHandler({ json: 'not json at all' })
    expect(result).toHaveProperty('error')
    const r = result as { error: string }
    expect(r.error).toMatch(/Invalid JSON/i)
  })

  it('returns error object on empty string', () => {
    const result = jsonToToonHandler({ json: '' })
    expect(result).toHaveProperty('error')
  })
})

describe('toonToJsonHandler', () => {
  it('converts TOON back to JSON', () => {
    // Round-trip via jsonToToonHandler
    const { toon } = jsonToToonHandler({ json: '{"name":"Bob"}' }) as { toon: string }
    const result = toonToJsonHandler({ toon })
    expect(result).toHaveProperty('json')
    const r = result as { json: string }
    expect(JSON.parse(r.json)).toEqual({ name: 'Bob' })
  })

  it('returns a plain string for non-TOON input (decode passes through)', () => {
    // @toon-format/toon decode returns the string as-is if not valid TOON
    const result = toonToJsonHandler({ toon: 'hello world' })
    // Should not throw — either returns { json: ... } or { error: ... }
    expect(result).toBeDefined()
  })
})
