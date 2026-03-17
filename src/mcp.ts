import { toToon, toJson, ToonOptions } from './core.js'

export interface JsonToToonArgs {
  json: string
  delimiter?: ',' | '\t' | '|'
  keyFolding?: 'off' | 'safe'
}

export interface ToonToJsonArgs {
  toon: string
}

export function jsonToToonHandler(args: JsonToToonArgs): { toon: string } {
  const opts: ToonOptions = {
    delimiter: args.delimiter,
    keyFolding: args.keyFolding,
  }
  return { toon: toToon(args.json, opts) }
}

export function toonToJsonHandler(args: ToonToJsonArgs): { json: string } {
  return { json: toJson(args.toon) }
}
