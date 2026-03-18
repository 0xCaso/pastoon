# Cross-Platform Service Manager Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `pastoon` fully cross-platform — tray works on macOS, Linux, and Windows; `setup`/`start`/`stop`/`uninstall` commands dispatch to the correct background service mechanism per OS.

**Architecture:** Replace `src/launchagent.ts` with a platform-dispatch interface in `src/service.ts` plus three platform-specific implementations (`service-macos.ts`, `service-linux.ts`, `service-windows.ts`). Fix the hardcoded `tray_darwin_release` binary name in `src/tray.ts`. Update `src/cli.ts` to import from `service.ts` instead of `launchagent.ts`.

**Tech Stack:** TypeScript (ESM), Node.js built-ins (`child_process`, `fs`, `os`, `path`), `systray2` (ships all 3 platform binaries), no new dependencies.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/service.ts` | **Create** | Common interface + platform dispatch |
| `src/service-macos.ts` | **Create** | LaunchAgent (code moved from `launchagent.ts`) |
| `src/service-linux.ts` | **Create** | systemd user service |
| `src/service-windows.ts` | **Create** | Registry `Run` key |
| `src/launchagent.ts` | **Delete** | Replaced by `service-macos.ts` |
| `src/tray.ts` | **Modify** | Fix hardcoded `tray_darwin_release` binary name |
| `src/cli.ts` | **Modify** | Import from `service.ts` instead of `launchagent.ts`; remove `PLIST_LABEL` constant |
| `test/service.test.ts` | **Create** | Unit tests for `service.ts` dispatch logic |

---

## Task 1: Create `src/service.ts` — common interface and platform dispatch

**Files:**
- Create: `src/service.ts`

- [ ] **Step 1: Write the failing test**

Create `test/service.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock all three platform modules before importing service
vi.mock('../src/service-macos.js', () => ({
  install: vi.fn(),
  uninstall: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  isInstalled: vi.fn().mockReturnValue(false),
}))
vi.mock('../src/service-linux.js', () => ({
  install: vi.fn(),
  uninstall: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  isInstalled: vi.fn().mockReturnValue(false),
}))
vi.mock('../src/service-windows.js', () => ({
  install: vi.fn(),
  uninstall: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  isInstalled: vi.fn().mockReturnValue(false),
}))

describe('service dispatch', () => {
  it('exports install, uninstall, start, stop, isInstalled functions', async () => {
    const svc = await import('../src/service.js')
    expect(typeof svc.install).toBe('function')
    expect(typeof svc.uninstall).toBe('function')
    expect(typeof svc.start).toBe('function')
    expect(typeof svc.stop).toBe('function')
    expect(typeof svc.isInstalled).toBe('function')
  })

  it('isInstalled returns a boolean', async () => {
    const svc = await import('../src/service.js')
    expect(typeof svc.isInstalled()).toBe('boolean')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --reporter=verbose test/service.test.ts
```

Expected: FAIL — `../src/service.js` does not exist.

- [ ] **Step 3: Create `src/service.ts`**

Use dynamic ESM `import()` for platform dispatch so Vitest mocking works correctly (Vitest intercepts ESM `import()` calls, not `require()`).

```ts
import { platform } from 'node:os'

export interface ServiceManager {
  install(): void
  uninstall(): void
  start(): void
  stop(): void
  isInstalled(): boolean
}

// Resolved once at module load time via top-level await
const p = platform()
const _svc: ServiceManager = await (async () => {
  if (p === 'darwin') return import('./service-macos.js') as Promise<ServiceManager>
  if (p === 'linux')  return import('./service-linux.js') as Promise<ServiceManager>
  if (p === 'win32')  return import('./service-windows.js') as Promise<ServiceManager>
  throw new Error(`Unsupported platform: ${p}. Supported: darwin, linux, win32.`)
})()

export function install(): void          { _svc.install() }
export function uninstall(): void        { _svc.uninstall() }
export function start(): void            { _svc.start() }
export function stop(): void             { _svc.stop() }
export function isInstalled(): boolean   { return _svc.isInstalled() }
```

**Note on top-level await:** This requires `"module": "NodeNext"` (or `"ES2022"`+) in `tsconfig.json`, which the project already has. The dynamic `import()` returns the module namespace object, which satisfies `ServiceManager` since the platform files export `install`, `uninstall`, `start`, `stop`, `isInstalled` as named exports directly.

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- --reporter=verbose test/service.test.ts
```

Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/service.ts test/service.test.ts
git commit -m "feat: add service.ts platform dispatch interface"
```

---

## Task 2: Create `src/service-macos.ts` — move LaunchAgent code

**Files:**
- Create: `src/service-macos.ts`
- Delete: `src/launchagent.ts` (after verifying no other imports)

- [ ] **Step 1: Create `src/service-macos.ts`**

This is essentially `launchagent.ts` renamed and shaped to the `ServiceManager` interface. Copy the file and rename exports:

```ts
import { writeFileSync, existsSync, rmSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { execSync } from 'node:child_process'

const LAUNCH_AGENTS_DIR = join(homedir(), 'Library', 'LaunchAgents')
const PLIST_PATH = join(LAUNCH_AGENTS_DIR, 'com.pastoon.plist')
const LABEL = 'com.pastoon'

function getNodeBin(): string {
  return process.execPath
}

function getPastoonScript(): string {
  try {
    const pastoonBin = execSync('which pastoon', { encoding: 'utf8' }).trim()
    const resolved = execSync(`readlink "${pastoonBin}" 2>/dev/null || echo "${pastoonBin}"`, {
      encoding: 'utf8',
    }).trim()
    if (resolved.startsWith('/')) return resolved
    const binDir = pastoonBin.replace(/\/[^/]+$/, '')
    return join(binDir, resolved)
  } catch {
    return '/usr/local/bin/pastoon'
  }
}

function buildPlist(nodeBin: string, scriptPath: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${nodeBin}</string>
    <string>${scriptPath}</string>
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

export function install(): void {
  mkdirSync(LAUNCH_AGENTS_DIR, { recursive: true })
  const nodeBin = getNodeBin()
  const scriptPath = getPastoonScript()
  writeFileSync(PLIST_PATH, buildPlist(nodeBin, scriptPath), 'utf8')
  try {
    execSync(`launchctl load "${PLIST_PATH}"`, { stdio: 'inherit' })
  } catch {
    // May fail if already loaded — not fatal
  }
}

export function uninstall(): void {
  try {
    execSync(`launchctl unload "${PLIST_PATH}"`, { stdio: 'inherit' })
  } catch {
    // May fail if not loaded — not fatal
  }
  if (existsSync(PLIST_PATH)) rmSync(PLIST_PATH)
}

export function start(): void {
  execSync(`launchctl start "${LABEL}"`, { stdio: 'inherit' })
}

export function stop(): void {
  execSync(`launchctl stop "${LABEL}"`, { stdio: 'inherit' })
}

export function isInstalled(): boolean {
  return existsSync(PLIST_PATH)
}
```

- [ ] **Step 2: Verify existing tests still pass**

```bash
npm run build && npm test
```

Expected: all tests pass (launchagent.ts not yet deleted — no breakage yet).

- [ ] **Step 3: Delete `src/launchagent.ts`**

```bash
rm src/launchagent.ts
```

- [ ] **Step 4: Build to confirm no dangling imports**

```bash
npm run build
```

Expected: TypeScript error on `src/cli.ts` — it still imports from `./launchagent.js`. This is expected; will be fixed in Task 5.

- [ ] **Step 5: Commit**

```bash
git add src/service-macos.ts
git rm src/launchagent.ts
git commit -m "feat: add service-macos.ts (moved from launchagent.ts)"
```

---

## Task 3: Create `src/service-linux.ts` — systemd user service

**Files:**
- Create: `src/service-linux.ts`

The Linux background service mechanism is a **systemd user service**. This runs under the user's session (no root required), starts automatically at login, and is managed via `systemctl --user`.

- [ ] **Step 1: Create `src/service-linux.ts`**

```ts
import { writeFileSync, existsSync, rmSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { execSync } from 'node:child_process'

const SYSTEMD_DIR = join(homedir(), '.config', 'systemd', 'user')
const SERVICE_PATH = join(SYSTEMD_DIR, 'pastoon.service')

function getNodeBin(): string {
  return process.execPath
}

function getPastoonScript(): string {
  try {
    const pastoonBin = execSync('which pastoon', { encoding: 'utf8' }).trim()
    const resolved = execSync(`readlink -f "${pastoonBin}" 2>/dev/null || echo "${pastoonBin}"`, {
      encoding: 'utf8',
    }).trim()
    return resolved || pastoonBin
  } catch {
    return '/usr/local/bin/pastoon'
  }
}

function buildServiceUnit(nodeBin: string, scriptPath: string): string {
  return `[Unit]
Description=pastoon — clipboard JSON to TOON converter
After=graphical-session.target

[Service]
Type=simple
ExecStart=${nodeBin} ${scriptPath} --tray
Restart=on-failure
StandardOutput=append:%h/.pastoon/pastoon.log
StandardError=append:%h/.pastoon/pastoon.error.log

[Install]
WantedBy=default.target
`
}

export function install(): void {
  mkdirSync(SYSTEMD_DIR, { recursive: true })
  const nodeBin = getNodeBin()
  const scriptPath = getPastoonScript()
  writeFileSync(SERVICE_PATH, buildServiceUnit(nodeBin, scriptPath), 'utf8')
  try {
    execSync('systemctl --user daemon-reload', { stdio: 'inherit' })
    execSync('systemctl --user enable --now pastoon.service', { stdio: 'inherit' })
  } catch {
    // May fail in non-systemd environments (e.g. WSL without systemd)
  }
}

export function uninstall(): void {
  try {
    execSync('systemctl --user disable --now pastoon.service', { stdio: 'inherit' })
  } catch {
    // Not running or not enabled — not fatal
  }
  if (existsSync(SERVICE_PATH)) rmSync(SERVICE_PATH)
  try {
    execSync('systemctl --user daemon-reload', { stdio: 'inherit' })
  } catch { /* best-effort */ }
}

export function start(): void {
  execSync('systemctl --user start pastoon.service', { stdio: 'inherit' })
}

export function stop(): void {
  execSync('systemctl --user stop pastoon.service', { stdio: 'inherit' })
}

export function isInstalled(): boolean {
  return existsSync(SERVICE_PATH)
}
```

- [ ] **Step 2: Build to verify no TypeScript errors**

```bash
npm run build
```

Expected: TypeScript error on `cli.ts` import of `launchagent.js` (still there — will fix in Task 5). The new file itself should compile cleanly.

- [ ] **Step 3: Commit**

```bash
git add src/service-linux.ts
git commit -m "feat: add service-linux.ts (systemd user service)"
```

---

## Task 4: Create `src/service-windows.ts` — Registry Run key

**Files:**
- Create: `src/service-windows.ts`

The Windows autostart mechanism is the registry `Run` key under `HKCU` (current user, no admin required). Node.js on Windows can read/write the registry via `reg` CLI tool (ships with all Windows versions).

- [ ] **Step 1: Create `src/service-windows.ts`**

```ts
import { execSync } from 'node:child_process'

const REG_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'
const REG_NAME = 'pastoon'

function getNodeBin(): string {
  return process.execPath
}

function getPastoonScript(): string {
  try {
    // On Windows `where pastoon` returns the full path
    const pastoonBin = execSync('where pastoon', { encoding: 'utf8' }).trim().split('\n')[0].trim()
    return pastoonBin
  } catch {
    return 'pastoon'
  }
}

function buildRunValue(nodeBin: string, scriptPath: string): string {
  // Quote both paths in case they contain spaces
  return `"${nodeBin}" "${scriptPath}" --tray`
}

export function install(): void {
  const nodeBin = getNodeBin()
  const scriptPath = getPastoonScript()
  const value = buildRunValue(nodeBin, scriptPath)
  execSync(`reg add "${REG_KEY}" /v "${REG_NAME}" /t REG_SZ /d "${value}" /f`, {
    stdio: 'inherit',
  })
  // Start immediately (detached)
  const { spawn } = require('node:child_process')
  spawn(nodeBin, [scriptPath, '--tray'], {
    detached: true,
    stdio: 'ignore',
  }).unref()
}

export function uninstall(): void {
  try {
    execSync(`reg delete "${REG_KEY}" /v "${REG_NAME}" /f`, { stdio: 'inherit' })
  } catch {
    // Key may not exist — not fatal
  }
  // Kill running tray process
  try {
    execSync('taskkill /F /IM pastoon.exe /T', { stdio: 'ignore' })
  } catch { /* not running */ }
}

export function start(): void {
  const nodeBin = getNodeBin()
  const scriptPath = getPastoonScript()
  const { spawn } = require('node:child_process')
  spawn(nodeBin, [scriptPath, '--tray'], {
    detached: true,
    stdio: 'ignore',
  }).unref()
}

export function stop(): void {
  try {
    // Kill by matching command line — more reliable than window title for background processes
    execSync('wmic process where "commandline like \'%pastoon%--tray%\'" delete', { stdio: 'ignore' })
  } catch { /* not running */ }
}

export function isInstalled(): boolean {
  try {
    execSync(`reg query "${REG_KEY}" /v "${REG_NAME}"`, { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}
```

**Note on `require` in ESM:** Use `createRequire(import.meta.url)` for the `spawn` import on Windows just as in `service.ts`, or simply import `spawn` at the top of the file from `node:child_process` (preferred — cleaner):

Replace both `require('node:child_process')` inline calls with a top-level import:
```ts
import { execSync, spawn } from 'node:child_process'
```

- [ ] **Step 2: Build to verify no TypeScript errors**

```bash
npm run build
```

Expected: TypeScript error on `cli.ts` still (will fix Task 5). New file should compile cleanly.

- [ ] **Step 3: Commit**

```bash
git add src/service-windows.ts
git commit -m "feat: add service-windows.ts (registry Run key + process spawn)"
```

---

## Task 5: Update `src/cli.ts` — import from `service.ts`, remove `launchctl` calls

**Files:**
- Modify: `src/cli.ts`

- [ ] **Step 1: Update imports and commands**

In `src/cli.ts`:

1. Replace:
   ```ts
   import { installLaunchAgent, uninstallLaunchAgent } from './launchagent.js'
   ```
   With:
   ```ts
   import { install as serviceInstall, uninstall as serviceUninstall, start as serviceStart, stop as serviceStop } from './service.js'
   ```

2. Remove the `PLIST_LABEL` constant (no longer needed — platform service modules handle their own labels).

3. Replace the `setup` command body:
   ```ts
   // Before:
   installLaunchAgent()
   
   // After:
   serviceInstall()
   ```

4. Replace the `stop` command body:
   ```ts
   // Before:
   execSync(`launchctl stop "${PLIST_LABEL}"`)
   
   // After:
   serviceStop()
   ```
   Wrap in try/catch returning `{ stopped: false, error: '...' }` on failure (same pattern as before).

5. Replace the `start` command body:
   ```ts
   // Before:
   execSync(`launchctl start "${PLIST_LABEL}"`)
   
   // After:
   serviceStart()
   ```
   Wrap in try/catch returning `{ started: false, error: '...' }` on failure.

6. Replace the `uninstall` command body:
   ```ts
   // Before:
   uninstallLaunchAgent()
   
   // After:
   serviceUninstall()
   ```

7. Remove the `execSync` import if it is no longer used anywhere else in the file. Check first — it's used in `stop` and `start` only via `launchctl`, which are now gone.

- [ ] **Step 2: Build to verify clean compilation**

```bash
npm run build
```

Expected: clean build, zero TypeScript errors.

- [ ] **Step 3: Run all tests**

```bash
npm test
```

Expected: all 24+ tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/cli.ts
git commit -m "feat: update cli.ts to use platform-agnostic service.ts"
```

---

## Task 6: Fix `src/tray.ts` — cross-platform binary name

**Files:**
- Modify: `src/tray.ts`

- [ ] **Step 1: Update `ensureTrayBinExecutable()`**

In `src/tray.ts`, locate line:
```ts
const binName = `tray_darwin_release`
```

Replace with:
```ts
const binName =
  process.platform === 'win32'
    ? 'tray_windows_release.exe'
    : process.platform === 'linux'
      ? 'tray_linux_release'
      : 'tray_darwin_release'
```

The `chmodSync` call below is a no-op on Windows (Node silently ignores it), so no further changes are needed there.

- [ ] **Step 2: Build and run tests**

```bash
npm run build && npm test
```

Expected: all tests pass.

- [ ] **Step 3: Verify tray still starts on macOS**

```bash
node dist/cli.js --tray &
sleep 2
kill %1
```

Expected: no crash, menu bar icon appears briefly.

- [ ] **Step 4: Commit**

```bash
git add src/tray.ts
git commit -m "fix: select correct systray2 binary per platform (linux/windows/darwin)"
```

---

## Task 7: Update CI and package.json — remove macOS-only restriction, update CI matrix

**Files:**
- Modify: `.github/workflows/release.yml`
- Modify: `package.json`

- [ ] **Step 1: Remove macOS-only `os` field (if present) from `package.json`**

Verify `package.json` does NOT have an `"os": ["darwin"]` field. If it does, remove it. Currently it doesn't — no change needed.

- [ ] **Step 2: Update GitHub Actions workflow to test on ubuntu-latest too**

In `.github/workflows/release.yml`, the current runner is `macos-latest`. Since the tray tests require a display (systray2 spawns a native binary), we cannot run tray tests headlessly on Linux CI. However, non-tray unit tests (core, config, mcp, CLI pipe) can run on Linux.

Add a separate CI test job for Linux that excludes tray-dependent tests. The simplest approach: add `ubuntu-latest` to the release workflow's test step using a matrix, but skip the tray binary test. Since our test suite doesn't directly test the tray binary (only unit tests), all 24 tests should pass on Linux CI without a display.

Replace:
```yaml
jobs:
  release:
    runs-on: macos-latest
```

With:
```yaml
jobs:
  release:
    runs-on: macos-latest
```

Keep `macos-latest` for the release job (publish + release creation). Optionally add a separate `test` job:

```yaml
  test-linux:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build
      - run: npm test
```

**Note:** The `cli.test.ts` tests that use `--pipe` should work on Linux. Tests that call `pastoon --help`, `--version`, `--llms` run `node dist/cli.js` which doesn't start the tray, so they work fine. Only `pastoon setup` / `pastoon --tray` would fail on headless Linux (no display server) — but those aren't in the test suite.

- [ ] **Step 3: Build and verify full test suite still passes**

```bash
npm run build && npm test
```

Expected: all tests pass.

- [ ] **Step 4: Commit and push**

```bash
git add .github/workflows/release.yml package.json
git commit -m "ci: add ubuntu-latest test job for cross-platform verification"
git push
```

---

## Task 8: Final verification and version bump

- [ ] **Step 1: Full clean build and test**

```bash
npm run build && npm test
```

Expected: all tests pass (24+).

- [ ] **Step 2: Smoke test macOS tray (manual)**

```bash
pastoon setup    # should install LaunchAgent and start tray
pastoon stop     # should stop it
pastoon start    # should start it again
pastoon uninstall # should remove LaunchAgent and stop tray
```

- [ ] **Step 3: Bump version to 0.2.0 and push tag**

```bash
npm version minor   # bumps to 0.2.0, commits, creates v0.2.0 tag
git push origin main --follow-tags
```

CI will build, test (macOS + Linux), publish `pastoon@0.2.0`, and create a GitHub release automatically.
