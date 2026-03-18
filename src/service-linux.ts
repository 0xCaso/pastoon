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
