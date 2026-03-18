import { toToon, toJson, ToonOptions } from './core.js'

export interface JsonToToonArgs {
  json: string
  delimiter?: ',' | '\t' | '|'
  keyFolding?: 'off' | 'safe'
}

export interface ToonToJsonArgs {
  toon: string
}

export function jsonToToonHandler(
  args: JsonToToonArgs,
): { toon: string } | { error: string } {
  try {
    const opts: ToonOptions = {
      delimiter: args.delimiter,
      keyFolding: args.keyFolding,
    }
    return { toon: toToon(args.json, opts) }
  } catch (err) {
    return { error: `Invalid JSON input: ${err instanceof Error ? err.message : String(err)}` }
  }
}

export function toonToJsonHandler(
  args: ToonToJsonArgs,
): { json: string } | { error: string } {
  try {
    return { json: toJson(args.toon) }
  } catch (err) {
    return { error: `Invalid TOON input: ${err instanceof Error ? err.message : String(err)}` }
  }
}
