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
