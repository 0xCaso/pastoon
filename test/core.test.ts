import { describe, it, expect } from 'vitest'
import { isValidJson, toToon, toJson } from '../src/core.js'

describe('isValidJson', () => {
  it('returns true for a valid JSON object', () => {
    expect(isValidJson('{"name":"Alice","age":30}')).toBe(true)
  })

  it('returns true for a valid JSON array', () => {
    expect(isValidJson('[1,2,3]')).toBe(true)
  })

  it('returns false for plain text', () => {
    expect(isValidJson('hello world')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isValidJson('')).toBe(false)
  })

  it('returns false for malformed JSON', () => {
    expect(isValidJson('{name: Alice}')).toBe(false)
  })

  it('returns false for JSON string primitive (not object/array)', () => {
    expect(isValidJson('"hello"')).toBe(false)
  })

  it('returns false for JSON number primitive', () => {
    expect(isValidJson('42')).toBe(false)
  })
})

describe('toToon', () => {
  it('converts a simple object', () => {
    const result = toToon('{"name":"Alice"}')
    expect(result).toContain('Alice')
    expect(result).not.toContain('{')
  })

  it('converts a uniform array to tabular TOON', () => {
    const json = '[{"id":1,"name":"Alice"},{"id":2,"name":"Bob"}]'
    const result = toToon(json)
    expect(result).toContain('Alice')
    expect(result).toContain('Bob')
  })

  it('round-trips through toJson', () => {
    const original = '{"users":[{"id":1,"name":"Alice"},{"id":2,"name":"Bob"}]}'
    const toon = toToon(original)
    const restored = toJson(toon)
    expect(JSON.parse(restored)).toEqual(JSON.parse(original))
  })
})

describe('toJson', () => {
  it('round-trips a simple TOON object back to JSON', () => {
    const original = '{"name":"Alice"}'
    const toon = toToon(original)
    const result = toJson(toon)
    expect(JSON.parse(result)).toEqual(JSON.parse(original))
  })
})
