import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const CONFIG_DIR = join(homedir(), '.pastoon')
const CONFIG_FILE = join(CONFIG_DIR, 'config.json')

export interface PastoonConfig {
  autoConvert: boolean
  delimiter: ',' | '\t' | '|'
  keyFolding: 'off' | 'safe'
  notifications: boolean
  pollInterval: number
}

export const DEFAULT_CONFIG: PastoonConfig = {
  autoConvert: true,
  delimiter: ',',
  keyFolding: 'off',
  notifications: true,
  pollInterval: 300,
}

export function readConfig(): PastoonConfig {
  if (!existsSync(CONFIG_FILE)) return { ...DEFAULT_CONFIG }
  try {
    const raw = readFileSync(CONFIG_FILE, 'utf8')
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export function writeConfig(partial: Partial<PastoonConfig>): PastoonConfig {
  const current = readConfig()
  const updated = { ...current, ...partial }
  mkdirSync(CONFIG_DIR, { recursive: true })
  writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf8')
  return updated
}
