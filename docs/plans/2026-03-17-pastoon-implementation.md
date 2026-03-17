# pastoon Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and publish `pastoon` — an npm CLI that auto-converts clipboard JSON to TOON format, with a macOS menu bar tray, MCP server via incur, and a SETUP.md for agent-driven install.

**Architecture:** `core.ts` handles pure JSON detection and TOON conversion (no I/O). `cli.ts` wires everything into an incur CLI that covers the one-shot, pipe, setup, and tray modes. `tray.ts` is the long-running systray2 menu bar process. `launchagent.ts` installs/removes the macOS LaunchAgent. `config.ts` reads/writes `~/.pastoon/config.json`.

**Tech Stack:** TypeScript (ESM), `incur` (CLI + MCP), `@toon-format/toon` (TOON codec), `clipboardy` (clipboard I/O), `systray2` (native tray), Node.js built-ins for LaunchAgent plist writing.

---

## File Map

| File | Responsibility |
|------|---------------|
| `src/core.ts` | `isValidJson(text)`, `toToon(json, opts)`, `toJson(toon)` — pure, no side effects |
| `src/config.ts` | `readConfig()`, `writeConfig(partial)` — reads/writes `~/.pastoon/config.json` |
| `src/launchagent.ts` | `installLaunchAgent()`, `uninstallLaunchAgent()` — writes/removes plist, runs `launchctl` |
| `src/tray.ts` | `startTray()` — systray2 menu bar + clipboard polling loop |
| `src/mcp.ts` | `jsonToToon(args)`, `toonToJson(args)` — pure tool handler functions consumed by cli.ts |
| `src/cli.ts` | incur `Cli.create('pastoon', ...)` with all commands wired to the above modules |
| `test/core.test.ts` | Unit tests for `isValidJson`, `toToon`, `toJson` |
| `test/config.test.ts` | Unit tests for `readConfig`, `writeConfig` |
| `test/cli.test.ts` | Integration smoke tests for the CLI commands |
| `docs/SETUP.md` | "Give this to your agent" four-tier install guide |
| `package.json` | ESM, `bin: { pastoon: "dist/cli.js" }`, build/test scripts |
| `tsconfig.json` | ESM target, `NodeNext` modules |
| `.gitignore` | `node_modules`, `dist` |
| `README.md` | Public-facing docs |

---

## Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`

- [ ] **Step 1: Initialize package.json**

```json
{
  "name": "pastoon",
  "version": "0.1.0",
  "description": "Auto-convert clipboard JSON to TOON — 40% fewer LLM tokens",
  "type": "module",
  "bin": { "pastoon": "dist/cli.js" },
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/cli.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "files": ["dist"],
  "dependencies": {
    "@toon-format/toon": "^2.1.0",
    "clipboardy": "^5.3.1",
    "incur": "^0.3.4",
    "systray2": "^2.1.4"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsx": "^4.21.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  },
  "keywords": ["toon", "json", "clipboard", "llm", "tokens", "mcp"],
  "license": "MIT"
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "declaration": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create .gitignore**

```
node_modules/
dist/
*.log
.DS_Store
```

- [ ] **Step 4: Install dependencies**

```bash
npm install
```

Expected: `node_modules` created, `package-lock.json` generated, no errors.

- [ ] **Step 5: Create src/ directory and verify structure**

```bash
mkdir -p src test docs
```

- [ ] **Step 6: Commit scaffold**

```bash
git add package.json tsconfig.json .gitignore package-lock.json
git commit -m "chore: project scaffold with dependencies"
```

---

## Task 2: core.ts — JSON detection and TOON conversion

**Files:**
- Create: `src/core.ts`
- Create: `test/core.test.ts`

**Key facts about `@toon-format/toon`:**
- Import: `import { encode, decode } from '@toon-format/toon'`
- `encode(value: unknown, opts?: { delimiter?: string; keyFolding?: 'off' | 'safe' }): string` — takes a parsed JS value, returns TOON string
- `decode(toon: string): unknown` — takes TOON string, returns parsed JS value
- To convert JSON string → TOON: `encode(JSON.parse(jsonString))`
- To convert TOON string → JSON: `JSON.stringify(decode(toonString))`

> **Verify the exact import surface before writing implementation by running:**
> `node -e "import('@toon-format/toon').then(m => console.log(Object.keys(m)))"`
> Adjust import names if they differ from above.

- [ ] **Step 1: Write the failing tests**

`test/core.test.ts`:
```typescript
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
  it('throws on invalid TOON', () => {
    expect(() => toJson('not valid toon @@@@')).toThrow()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- test/core.test.ts
```

Expected: FAIL — `Cannot find module '../src/core.js'`

- [ ] **Step 3: Implement src/core.ts**

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- test/core.test.ts
```

Expected: All tests PASS.

> If `encode`/`decode` imports fail, run the verification command from Step 1 notes and adjust imports.

- [ ] **Step 5: Commit**

```bash
git add src/core.ts test/core.test.ts
git commit -m "feat: core JSON detection and TOON conversion"
```

---

## Task 3: config.ts — Read/write config file

**Files:**
- Create: `src/config.ts`
- Create: `test/config.test.ts`

- [ ] **Step 1: Write the failing tests**

`test/config.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { readConfig, writeConfig, DEFAULT_CONFIG } from '../src/config.js'
import { rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const CONFIG_PATH = join(homedir(), '.pastoon-test', 'config.json')

// Override config dir for tests by monkey-patching the module won't work easily.
// Instead, test the defaults and types directly without file I/O.

describe('DEFAULT_CONFIG', () => {
  it('has expected defaults', () => {
    expect(DEFAULT_CONFIG.autoConvert).toBe(true)
    expect(DEFAULT_CONFIG.delimiter).toBe(',')
    expect(DEFAULT_CONFIG.keyFolding).toBe('off')
    expect(DEFAULT_CONFIG.notifications).toBe(true)
    expect(DEFAULT_CONFIG.pollInterval).toBe(300)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- test/config.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement src/config.ts**

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- test/config.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/config.ts test/config.test.ts
git commit -m "feat: config read/write with defaults"
```

---

## Task 4: launchagent.ts — macOS LaunchAgent management

**Files:**
- Create: `src/launchagent.ts`

No unit tests for this module — it shells out to `launchctl` and writes to `~/Library/LaunchAgents/`. Integration-tested manually during `pastoon setup`.

- [ ] **Step 1: Implement src/launchagent.ts**

```typescript
import { writeFileSync, existsSync, rmSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { execSync } from 'node:child_process'

const LAUNCH_AGENTS_DIR = join(homedir(), 'Library', 'LaunchAgents')
const PLIST_PATH = join(LAUNCH_AGENTS_DIR, 'com.pastoon.plist')
const LABEL = 'com.pastoon'

function getPastoonBin(): string {
  // When installed globally via npm, `pastoon` is on PATH.
  // Find the actual binary path for the plist.
  try {
    return execSync('which pastoon', { encoding: 'utf8' }).trim()
  } catch {
    return '/usr/local/bin/pastoon'
  }
}

function buildPlist(binPath: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${binPath}</string>
    <string>--tray</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/tmp/pastoon.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/pastoon.error.log</string>
</dict>
</plist>
`
}

export function installLaunchAgent(): void {
  mkdirSync(LAUNCH_AGENTS_DIR, { recursive: true })
  const binPath = getPastoonBin()
  writeFileSync(PLIST_PATH, buildPlist(binPath), 'utf8')
  try {
    execSync(`launchctl load "${PLIST_PATH}"`, { stdio: 'inherit' })
  } catch {
    // May fail if already loaded — not fatal
  }
}

export function uninstallLaunchAgent(): void {
  try {
    execSync(`launchctl unload "${PLIST_PATH}"`, { stdio: 'inherit' })
  } catch {
    // May fail if not loaded — not fatal
  }
  if (existsSync(PLIST_PATH)) rmSync(PLIST_PATH)
}

export function isLaunchAgentInstalled(): boolean {
  return existsSync(PLIST_PATH)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/launchagent.ts
git commit -m "feat: macOS LaunchAgent install/uninstall"
```

---

## Task 5: tray.ts — Menu bar process

**Files:**
- Create: `src/tray.ts`

This module runs as the long-lived background process (`pastoon --tray`). It:
1. Reads config
2. Starts systray2 with menu items
3. Polls clipboard every `config.pollInterval` ms
4. On JSON detected + `autoConvert` enabled: converts and writes back to clipboard

**Key facts about systray2:**
- Install: `npm install systray2`
- Import: `import Systray from 'systray2'`
- Menu structure: `{ icon: string (base64 or path), title: string, tooltip: string, items: MenuItem[] }`
- `MenuItem`: `{ title: string, tooltip: string, checked: boolean, enabled: boolean }`
- Separator: `{ title: '<separator>' }`
- Events: `systray.onClick(cb)` — cb receives `{ seq_id: number }` where seq_id is the item index
- `systray.sendAction({ type: 'update-item', item: { ...updated }, seq_id: number })` to update item state
- `systray.kill()` to stop

- [ ] **Step 1: Implement src/tray.ts**

```typescript
import Systray from 'systray2'
import clipboardy from 'clipboardy'
import { isValidJson, toToon, toJson } from './core.js'
import { readConfig, writeConfig } from './config.js'

// Menu item indices (must match the items array order below)
const IDX_TOGGLE = 0
// IDX_SEP1 = 1 (separator, not clickable)
const IDX_CONVERT_NOW = 2
const IDX_UNDO = 3
const IDX_REVERSE = 4
// IDX_SEP2 = 5 (separator, not clickable)
const IDX_QUIT = 6

export function startTray(): void {
  let config = readConfig()
  let lastOriginalJson: string | null = null
  let lastClipboard = ''

  const items: Systray.MenuItem[] = [
    {
      title: config.autoConvert ? '✓ Auto-convert JSON' : '  Auto-convert JSON',
      tooltip: 'Toggle auto-convert on/off',
      checked: config.autoConvert,
      enabled: true,
    },
    { title: '<separator>', tooltip: '', checked: false, enabled: false },
    {
      title: 'Convert clipboard now',
      tooltip: 'Manually trigger one conversion',
      checked: false,
      enabled: true,
    },
    {
      title: 'Undo (restore JSON)',
      tooltip: 'Restore last original JSON',
      checked: false,
      enabled: false,
    },
    {
      title: 'Reverse (TOON → JSON)',
      tooltip: 'Convert TOON in clipboard back to JSON',
      checked: false,
      enabled: true,
    },
    { title: '<separator>', tooltip: '', checked: false, enabled: false },
    {
      title: 'Quit',
      tooltip: 'Stop pastoon',
      checked: false,
      enabled: true,
    },
  ]

  const systray = new Systray({
    menu: {
      icon: '', // Will use default icon; replace with base64 PNG for branded icon
      title: '[P]',
      tooltip: 'pastoon — JSON → TOON clipboard converter',
      items,
    },
    debug: false,
    copyDir: true,
  })

  systray.onClick((action) => {
    switch (action.seq_id) {
      case IDX_TOGGLE: {
        config = writeConfig({ autoConvert: !config.autoConvert })
        systray.sendAction({
          type: 'update-item',
          item: {
            ...items[IDX_TOGGLE],
            title: config.autoConvert ? '✓ Auto-convert JSON' : '  Auto-convert JSON',
            checked: config.autoConvert,
          },
          seq_id: IDX_TOGGLE,
        })
        break
      }

      case IDX_CONVERT_NOW: {
        const text = clipboardy.readSync()
        if (isValidJson(text)) {
          lastOriginalJson = text
          const toon = toToon(text, { delimiter: config.delimiter, keyFolding: config.keyFolding })
          clipboardy.writeSync(toon)
          lastClipboard = toon
          // Enable undo
          systray.sendAction({
            type: 'update-item',
            item: { ...items[IDX_UNDO], enabled: true },
            seq_id: IDX_UNDO,
          })
        }
        break
      }

      case IDX_UNDO: {
        if (lastOriginalJson) {
          clipboardy.writeSync(lastOriginalJson)
          lastClipboard = lastOriginalJson
          lastOriginalJson = null
          systray.sendAction({
            type: 'update-item',
            item: { ...items[IDX_UNDO], enabled: false },
            seq_id: IDX_UNDO,
          })
        }
        break
      }

      case IDX_REVERSE: {
        const text = clipboardy.readSync()
        try {
          const json = toJson(text)
          clipboardy.writeSync(json)
          lastClipboard = json
          lastOriginalJson = null
        } catch {
          // Not valid TOON — ignore
        }
        break
      }

      case IDX_QUIT: {
        systray.kill()
        process.exit(0)
      }
    }
  })

  // Clipboard polling loop
  const poll = setInterval(() => {
    if (!config.autoConvert) return

    let current: string
    try {
      current = clipboardy.readSync()
    } catch {
      return
    }

    if (current === lastClipboard) return
    lastClipboard = current

    if (isValidJson(current)) {
      lastOriginalJson = current
      const toon = toToon(current, { delimiter: config.delimiter, keyFolding: config.keyFolding })
      clipboardy.writeSync(toon)
      lastClipboard = toon
      // Enable undo item
      systray.sendAction({
        type: 'update-item',
        item: { ...items[IDX_UNDO], enabled: true },
        seq_id: IDX_UNDO,
      })
    } else {
      // New non-JSON clipboard content — clear undo buffer
      lastOriginalJson = null
      systray.sendAction({
        type: 'update-item',
        item: { ...items[IDX_UNDO], enabled: false },
        seq_id: IDX_UNDO,
      })
    }
  }, config.pollInterval)

  // Keep process alive
  poll.unref()
  // systray itself keeps the process alive via its native binary
}
```

> **Note on systray2 API:** If the actual API differs from above (e.g., different constructor signature, event names, sendAction format), check `node_modules/systray2/README.md` or its TypeScript types and adjust accordingly. The logic structure stays the same.

- [ ] **Step 2: Commit**

```bash
git add src/tray.ts
git commit -m "feat: menu bar tray with clipboard polling"
```

---

## Task 6: mcp.ts — MCP tool handler functions

**Files:**
- Create: `src/mcp.ts`

These are pure functions consumed by `cli.ts`. They have no side effects beyond calling `core.ts`.

- [ ] **Step 1: Implement src/mcp.ts**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/mcp.ts
git commit -m "feat: MCP tool handler functions"
```

---

## Task 7: cli.ts — incur CLI wiring

**Files:**
- Create: `src/cli.ts`

This is the main entry point. It uses incur's `Cli.create().command().serve()` pattern. The `--mcp`, `mcp add`, and `skills add` built-ins come for free from incur — no custom code needed for them.

**Commands to define:**
- Default invocation (`pastoon` with no subcommand) → one-shot convert
- `pastoon --reverse` → one-shot reverse
- `pastoon --pipe` → stdin→stdout convert
- `pastoon setup` → install LaunchAgent + start tray
- `pastoon stop` → launchctl stop
- `pastoon start` → launchctl start
- `pastoon uninstall` → remove LaunchAgent + config
- `pastoon --tray` → start tray process (used by LaunchAgent; not in --help)

**Key incur pattern note:** incur does not support a "default command" (run when no subcommand given). The one-shot convert and `--reverse`/`--pipe` flags will be registered on the root `Cli.create()` directly by passing a `run` callback and `options` to `Cli.create()` itself (single-command CLI pattern, as shown in incur examples). Service subcommands are chained with `.command()`.

- [ ] **Step 1: Implement src/cli.ts**

```typescript
#!/usr/bin/env node
import { Cli, z } from 'incur'
import clipboardy from 'clipboardy'
import { execSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { isValidJson, toToon, toJson } from './core.js'
import { installLaunchAgent, uninstallLaunchAgent, isLaunchAgentInstalled } from './launchagent.js'
import { readConfig, writeConfig } from './config.js'
import { startTray } from './tray.js'

const PLIST_LABEL = 'com.pastoon'

const cli = Cli.create('pastoon', {
  version: '0.1.0',
  description: 'Auto-convert clipboard JSON to TOON — 40% fewer LLM tokens',
  options: z.object({
    reverse: z.boolean().optional().describe('Convert TOON in clipboard back to JSON'),
    pipe: z.boolean().optional().describe('Read from stdin, write TOON to stdout'),
    tray: z.boolean().optional().describe('Start menu bar tray (used by LaunchAgent)'),
  }),
  run(c) {
    const cfg = readConfig()

    // --tray: start background menu bar process
    if (c.options.tray) {
      startTray()
      return // startTray() keeps the process alive via systray2's native binary
    }

    // --pipe: stdin → stdout conversion
    if (c.options.pipe) {
      const chunks: Buffer[] = []
      process.stdin.on('data', (chunk) => chunks.push(chunk))
      process.stdin.on('end', () => {
        const input = Buffer.concat(chunks).toString('utf8').trim()
        if (isValidJson(input)) {
          process.stdout.write(toToon(input, { delimiter: cfg.delimiter, keyFolding: cfg.keyFolding }) + '\n')
        } else {
          process.stdout.write(input + '\n')
        }
        process.exit(0)
      })
      return
    }

    // --reverse: TOON → JSON one-shot
    if (c.options.reverse) {
      const text = clipboardy.readSync()
      try {
        const json = toJson(text)
        clipboardy.writeSync(json)
        return { converted: true, direction: 'toon→json' }
      } catch {
        return { converted: false, error: 'Clipboard does not contain valid TOON' }
      }
    }

    // Default: JSON → TOON one-shot
    const text = clipboardy.readSync()
    if (isValidJson(text)) {
      const toon = toToon(text, { delimiter: cfg.delimiter, keyFolding: cfg.keyFolding })
      clipboardy.writeSync(toon)
      return { converted: true, direction: 'json→toon' }
    }
    return { converted: false, error: 'Clipboard does not contain valid JSON' }
  },
})

cli.command('setup', {
  description: 'Install LaunchAgent and start menu bar tray',
  run() {
    installLaunchAgent()
    return { installed: true, autostart: true }
  },
})

cli.command('stop', {
  description: 'Stop the menu bar tray (does not remove LaunchAgent)',
  run() {
    try {
      execSync(`launchctl stop "${PLIST_LABEL}"`)
      return { stopped: true }
    } catch {
      return { stopped: false, error: 'Service not running or launchctl failed' }
    }
  },
})

cli.command('start', {
  description: 'Start the menu bar tray',
  run() {
    try {
      execSync(`launchctl start "${PLIST_LABEL}"`)
      return { started: true }
    } catch {
      return { started: false, error: 'Service not loaded. Run: pastoon setup' }
    }
  },
})

cli.command('uninstall', {
  description: 'Remove LaunchAgent, stop tray, and delete config',
  run() {
    uninstallLaunchAgent()
    rmSync(join(homedir(), '.pastoon'), { recursive: true, force: true })
    return { uninstalled: true }
  },
})

cli.serve()
```

- [ ] **Step 2: Build and verify it compiles**

```bash
npm run build
```

Expected: `dist/` directory created with `cli.js` and other compiled files. Zero TypeScript errors.

If errors appear, fix them before proceeding.

- [ ] **Step 3: Smoke test the built CLI**

```bash
node dist/cli.js --help
```

Expected output includes:
```
pastoon – Auto-convert clipboard JSON to TOON — 40% fewer LLM tokens
...
Commands:
  setup      Install LaunchAgent and start menu bar tray
  stop       Stop the menu bar tray
  start      Start the menu bar tray
  uninstall  Remove LaunchAgent, stop tray, and delete config
Built-in Commands:
  completions  Generate shell completion script
  mcp add      Register as MCP server
  skills add   Sync skill files to agents
Global Options:
  --mcp  Start as MCP stdio server
  ...
```

- [ ] **Step 4: Commit**

```bash
git add src/cli.ts dist/
git commit -m "feat: incur CLI wiring with all commands"
```

---

## Task 8: CLI integration tests

**Files:**
- Create: `test/cli.test.ts`

These are smoke tests verifying the built binary produces expected output shapes.

- [ ] **Step 1: Write tests**

`test/cli.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'

function run(args: string): string {
  return execSync(`node dist/cli.js ${args}`, { encoding: 'utf8' })
}

describe('pastoon CLI smoke tests', () => {
  it('--help shows pastoon description', () => {
    const output = run('--help')
    expect(output).toContain('pastoon')
    expect(output).toContain('TOON')
  })

  it('--version shows version', () => {
    const output = run('--version')
    expect(output).toMatch(/0\.\d+\.\d+/)
  })

  it('--pipe converts JSON from stdin', () => {
    const output = execSync(
      `echo '{"name":"Alice","role":"admin"}' | node dist/cli.js --pipe`,
      { encoding: 'utf8' }
    )
    expect(output).toContain('Alice')
    expect(output).toContain('admin')
    // TOON should not contain braces
    expect(output).not.toContain('{"name"')
  })

  it('--pipe passes through non-JSON unchanged', () => {
    const output = execSync(
      `echo 'hello world' | node dist/cli.js --pipe`,
      { encoding: 'utf8' }
    )
    expect(output.trim()).toBe('hello world')
  })

  it('--llms outputs command manifest', () => {
    const output = run('--llms')
    expect(output).toContain('pastoon')
    expect(output).toContain('setup')
  })
})
```

- [ ] **Step 2: Run tests**

```bash
npm run build && npm test -- test/cli.test.ts
```

Expected: All PASS.

- [ ] **Step 3: Commit**

```bash
git add test/cli.test.ts
git commit -m "test: CLI integration smoke tests"
```

---

## Task 9: Run full test suite and verify build

- [ ] **Step 1: Run all tests**

```bash
npm test
```

Expected: All tests in `test/core.test.ts`, `test/config.test.ts`, `test/cli.test.ts` PASS.

- [ ] **Step 2: Build production bundle**

```bash
npm run build
```

Expected: `dist/cli.js` exists, no TypeScript errors.

- [ ] **Step 3: Verify `pastoon --mcp` works**

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' | node dist/cli.js --mcp
```

Expected: JSON-RPC response with `result.serverInfo.name` containing "pastoon".

- [ ] **Step 4: Commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: resolve any remaining build/test issues"
```

---

## Task 10: docs/SETUP.md — "Give This to Your Agent"

**Files:**
- Create: `docs/SETUP.md`

This file is the primary distribution mechanism. A developer finds `pastoon`, pastes this file to their coding agent, says "set this up."

- [ ] **Step 1: Write docs/SETUP.md**

```markdown
# pastoon Setup

> Give this file to your coding agent and say: "Set up pastoon for me."
>
> Agent: read this top to bottom, execute each tier that applies.

## Tier 1 — Clipboard auto-conversion (the main feature)

Install pastoon globally and set it up to auto-convert JSON in your clipboard to TOON format (40% fewer LLM tokens) on every copy. Runs in the menu bar.

```bash
npm install -g pastoon
pastoon setup
```

That's it. From now on, every time you copy JSON, pastoon silently converts it to TOON before you paste.

To pause: click `[P]` in the menu bar → uncheck "Auto-convert JSON".
To resume: re-check it.

---

## Tier 2 — MCP server for coding agents

Register pastoon as an MCP server so your coding agents (Claude Code, OpenCode, Cursor, etc.) can call `json_to_toon` and `toon_to_json` directly in-context.

```bash
pastoon mcp add
```

This auto-detects your installed agents and writes the MCP config for each.

**Available MCP tools:**
- `json_to_toon` — convert a JSON string to TOON (40% fewer tokens)
- `toon_to_json` — convert a TOON string back to JSON

---

## Tier 3 — Manual CLI usage

One-shot convert (clipboard):
```bash
pastoon          # JSON → TOON
pastoon --reverse  # TOON → JSON
```

Pipe mode (stdin → stdout):
```bash
echo '{"name":"Alice"}' | pastoon --pipe
curl https://api.example.com/data | pastoon --pipe | llm "summarize this"
cat data.json | pastoon --pipe > data.toon
```

---

## Tier 4 — Uninstall / pause

Stop the tray (keeps LaunchAgent, restarts on next login):
```bash
pastoon stop
```

Start again:
```bash
pastoon start
```

Full removal (removes LaunchAgent, config, and tray):
```bash
pastoon uninstall
npm uninstall -g pastoon
```
```

- [ ] **Step 2: Commit**

```bash
git add docs/SETUP.md
git commit -m "docs: add SETUP.md for agent-driven install"
```

---

## Task 11: Generate docs/SKILL.md via incur

**Files:**
- Create: `docs/SKILL.md` (generated by `pastoon skills add`)

The spec requires `docs/SKILL.md` — a file that teaches coding agents when to use pastoon's MCP tools. incur generates this automatically from the CLI definition via `pastoon skills add`.

- [ ] **Step 1: Build the CLI and generate SKILL.md**

```bash
npm run build
node dist/cli.js skills add
```

Expected: A `SKILL.md` file is written to the current directory (or agent config dir — check incur output for exact path).

- [ ] **Step 2: Move generated SKILL.md to docs/ if needed**

```bash
# If generated in project root, move it:
mv SKILL.md docs/SKILL.md
```

If incur writes it directly to `docs/`, skip this step.

- [ ] **Step 3: Review the generated SKILL.md**

Open `docs/SKILL.md` and verify it includes:
- The `json_to_toon` tool with description about using it before large JSON data
- The `toon_to_json` tool
- The `pastoon` CLI command reference

Manually add any missing guidance about when NOT to convert (tiny JSON, JSON being written to a file).

- [ ] **Step 4: Commit**

```bash
git add docs/SKILL.md
git commit -m "docs: add generated SKILL.md for coding agents"
```

---

## Task 13: README.md

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README.md**

```markdown
# pastoon

> Auto-convert clipboard JSON to TOON — 40% fewer LLM tokens, zero friction.

## What it does

Every time you copy JSON, pastoon silently converts it to [TOON format](https://toonformat.dev/) before you paste — saving ~40% of tokens in LLM chat UIs, coding agents, and API calls.

```
JSON (verbose):                    TOON (40% fewer tokens):
{                                  users[3]{id,name,role}:
  "users": [                         1,Alice,admin
    {"id":1,"name":"Alice",          2,Bob,user
     "role":"admin"},                3,Carol,user
    ...
  ]
}
```

TOON is lossless — perfect JSON round-trip, same data model, just without the braces, quotes, and repeated keys.

## Install

```bash
npm install -g pastoon
pastoon setup
```

That's it. The `[P]` icon appears in your menu bar. Every JSON you copy is automatically converted.

## Agent install

If you use a coding agent (Claude Code, OpenCode, Cursor, Windsurf), give it [SETUP.md](./docs/SETUP.md):

> "Set up pastoon for me using the instructions in docs/SETUP.md"

## MCP server

pastoon exposes two MCP tools for agents working with JSON in context:

```bash
pastoon mcp add   # register with detected coding agents
pastoon --mcp     # start MCP server manually
```

**Tools:**
- `json_to_toon` — convert JSON string to TOON (use before reasoning over large JSON)
- `toon_to_json` — convert TOON string back to JSON

## CLI

```bash
pastoon            # JSON → TOON (clipboard)
pastoon --reverse  # TOON → JSON (clipboard)
pastoon --pipe     # stdin → stdout (for scripts)

pastoon setup      # install LaunchAgent + start tray
pastoon stop       # pause tray
pastoon start      # resume tray
pastoon uninstall  # full removal
```

## What is TOON?

[TOON (Token-Oriented Object Notation)](https://toonformat.dev/) is a compact, human-readable format for JSON data. It achieves:
- ~40% fewer tokens than JSON
- 76.4% LLM accuracy vs JSON's 75.0%
- Perfect lossless round-trip
- Spec-driven with implementations in TypeScript, Python, Go, Rust

## License

MIT
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README"
```

---

## Task 14: package.json final polish and npm publish prep

- [ ] **Step 1: Verify package.json has correct fields**

Check that `package.json` has:
- `"main": "dist/cli.js"`
- `"bin": { "pastoon": "dist/cli.js" }`
- `"files": ["dist", "docs/SETUP.md", "docs/SKILL.md"]`
- `"repository"`, `"bugs"`, `"homepage"` pointing to `0xCaso/pastoon`

Update as needed.

- [ ] **Step 2: Add shebang to the compiled output**

The compiled `dist/cli.js` needs `#!/usr/bin/env node` at the top to be executable as a global binary.

Add a `postbuild` script to `package.json` that prepends the shebang:

```json
"scripts": {
  "build": "tsc",
  "postbuild": "node -e \"const fs=require('fs');const f='dist/cli.js';const c=fs.readFileSync(f,'utf8');if(!c.startsWith('#!/'))fs.writeFileSync(f,'#!/usr/bin/env node\\n'+c)\" && chmod +x dist/cli.js",
  ...
}
```

Or alternatively, add `#!/usr/bin/env node` as the first line of `src/cli.ts` — TypeScript will preserve it:

```typescript
#!/usr/bin/env node
import { Cli, z } from 'incur'
// ...
```

The shebang approach in `src/cli.ts` is simpler. Use this.

- [ ] **Step 3: Rebuild and verify the binary is executable**

```bash
npm run build
head -1 dist/cli.js
```

Expected: `#!/usr/bin/env node`

```bash
chmod +x dist/cli.js
./dist/cli.js --version
```

Expected: version number printed.

- [ ] **Step 4: Run full test suite one final time**

```bash
npm test
```

Expected: All PASS.

- [ ] **Step 5: Commit final state**

```bash
git add -A
git commit -m "chore: final polish for npm publish"
```

---

## Task 15: Manual integration test (macOS only)

These steps require a human at the keyboard. They cannot be automated.

- [ ] **Step 1: Install globally from local source**

```bash
npm install -g .
which pastoon
```

Expected: path to globally installed `pastoon`.

- [ ] **Step 2: Test one-shot convert**

```bash
# Copy some JSON to clipboard manually, then:
pastoon
pbpaste   # should show TOON, not JSON
```

- [ ] **Step 3: Test pipe mode**

```bash
echo '{"id":1,"name":"Alice","role":"admin"}' | pastoon --pipe
```

Expected: TOON output, no braces.

- [ ] **Step 4: Test setup (requires macOS)**

```bash
pastoon setup
```

Expected: `[P]` appears in menu bar. Check `~/Library/LaunchAgents/com.pastoon.plist` exists.

- [ ] **Step 5: Test MCP**

```bash
pastoon mcp add
```

Expected: Reports which agents were detected and configured.

- [ ] **Step 6: Test uninstall**

```bash
pastoon uninstall
```

Expected: `[P]` disappears from menu bar. Plist file removed.

---

## Known Risks / Watchpoints

| Risk | Mitigation |
|------|-----------|
| `@toon-format/toon` API surface differs from assumed `encode`/`decode` | Verify with `node -e "import('@toon-format/toon').then(m=>console.log(Object.keys(m)))"` before Task 2 Step 3 |
| `systray2` API differs from documented | Check `node_modules/systray2/README.md` and TypeScript types before Task 5 |
| incur `Cli.create` with root `run` and subcommands conflicts | The single-command pattern with `.command()` chaining is explicitly supported per incur README |
| `--pipe` stdin handling in incur's `run` context | incur `run` is synchronous by default; the stdin handler needs to not `return` early — test carefully |
| LaunchAgent binary path on Apple Silicon vs Intel | `which pastoon` handles this correctly at install time |
