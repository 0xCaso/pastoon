import { encode, decode } from '@toon-format/toon'

export interface ToonOptions {
  delimiter?: ',' | '\t' | '|'
  keyFolding?: 'off' | 'safe'
}

/**
 * Returns true if text is a valid JSON object or array.
 * Quick prefix check avoids JSON.parse on plain text.
 */
export function isValidJson(text: string): boolean {
  if (!text || text.trim().length === 0) return false
  const t = text.trim()
  if (t[0] !== '{' && t[0] !== '[') return false
  try {
    JSON.parse(t)
    return true
  } catch {
    return false
  }
}

/**
 * Convert a JSON string to TOON format.
 * Throws if the input is not valid JSON.
 */
export function toToon(jsonString: string, opts: ToonOptions = {}): string {
  const value = JSON.parse(jsonString)
  return encode(value, {
    delimiter: opts.delimiter ?? ',',
    keyFolding: opts.keyFolding ?? 'off',
  })
}

/**
 * Convert a TOON string back to a JSON string.
 * Throws if the input is not valid TOON.
 */
export function toJson(toonString: string): string {
  return JSON.stringify(decode(toonString))
}
