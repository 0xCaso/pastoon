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
