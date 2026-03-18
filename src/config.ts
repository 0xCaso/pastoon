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
    const parsed = JSON.parse(raw) as Partial<PastoonConfig>
    return sanitizeConfig({ ...DEFAULT_CONFIG, ...parsed })
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

/**
 * Sanitize config values to prevent bad data (e.g., corrupt file) from
 * causing runaway setInterval or invalid TOON output.
 */
function sanitizeConfig(cfg: PastoonConfig): PastoonConfig {
  const VALID_DELIMITERS: Array<PastoonConfig['delimiter']> = [',', '\t', '|']
  const VALID_KEY_FOLDING: Array<PastoonConfig['keyFolding']> = ['off', 'safe']

  return {
    autoConvert: typeof cfg.autoConvert === 'boolean' ? cfg.autoConvert : DEFAULT_CONFIG.autoConvert,
    delimiter: VALID_DELIMITERS.includes(cfg.delimiter) ? cfg.delimiter : DEFAULT_CONFIG.delimiter,
    keyFolding: VALID_KEY_FOLDING.includes(cfg.keyFolding)
      ? cfg.keyFolding
      : DEFAULT_CONFIG.keyFolding,
    notifications:
      typeof cfg.notifications === 'boolean' ? cfg.notifications : DEFAULT_CONFIG.notifications,
    pollInterval:
      typeof cfg.pollInterval === 'number' && isFinite(cfg.pollInterval) && cfg.pollInterval > 0
        ? Math.max(100, Math.min(cfg.pollInterval, 60_000)) // clamp 100ms–60s
        : DEFAULT_CONFIG.pollInterval,
  }
}

export function writeConfig(partial: Partial<PastoonConfig>): PastoonConfig {
  const current = readConfig()
  const updated = { ...current, ...partial }
  mkdirSync(CONFIG_DIR, { recursive: true })
  writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf8')
  return updated
}
