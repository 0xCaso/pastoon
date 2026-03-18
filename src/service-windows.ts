import { execSync, spawn } from 'node:child_process'

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
