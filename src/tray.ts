import { createRequire } from 'node:module'
import { chmodSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import clipboardy from 'clipboardy'

const require = createRequire(import.meta.url)
// systray2 is CommonJS; `.default` holds the class
// eslint-disable-next-line @typescript-eslint/no-require-imports
const _systrayModule = require('systray2') as { default: typeof import('systray2')['default'] }
// eslint-disable-next-line @typescript-eslint/no-require-imports
const _systrayPkg = require('systray2/package.json') as { version: string }
const SysTrayClass = _systrayModule.default
type SysTray = import('systray2').default
type MenuItem = import('systray2').MenuItem
type ClickEvent = import('systray2').ClickEvent
import { isValidJson, toToon, toJson } from './core.js'
import { readConfig, writeConfig } from './config.js'

/**
 * systray2 ships its tray binary without the execute bit set, and its internal
 * chmod call silently swallows errors. We fix permissions before instantiating
 * SysTrayClass so the spawn doesn't fail with EACCES.
 */
function ensureTrayBinExecutable(): void {
  const binName = `tray_darwin_release`
  // systray2 with copyDir:true caches the binary in ~/.cache/node-systray/<version>/
  const cachedPath = join(
    homedir(),
    '.cache',
    'node-systray',
    _systrayPkg.version,
    binName,
  )
  // Also fix the bundled source binary so the first copy is already executable
  const sourcePath = join(
    new URL('..', import.meta.url).pathname,
    'node_modules',
    'systray2',
    'traybin',
    binName,
  )
  for (const p of [cachedPath, sourcePath]) {
    try {
      if (existsSync(p)) chmodSync(p, 0o755)
    } catch {
      // best-effort
    }
  }
}

export function startTray(): void {
  ensureTrayBinExecutable()
  let config = readConfig()
  let lastOriginalJson: string | null = null
  let lastClipboard = ''

  const itemToggle: MenuItem = {
    title: config.autoConvert ? '✓ Auto-convert JSON' : '  Auto-convert JSON',
    tooltip: 'Toggle auto-convert on/off',
    checked: config.autoConvert,
    enabled: true,
  }

  const itemConvertNow: MenuItem = {
    title: 'Convert clipboard now',
    tooltip: 'Manually trigger one conversion',
    checked: false,
    enabled: true,
  }

  const itemUndo: MenuItem = {
    title: 'Undo (restore JSON)',
    tooltip: 'Restore last original JSON',
    checked: false,
    enabled: false,
  }

  const itemReverse: MenuItem = {
    title: 'Reverse (TOON → JSON)',
    tooltip: 'Convert TOON in clipboard back to JSON',
    checked: false,
    enabled: true,
  }

  const itemQuit: MenuItem = {
    title: 'Quit',
    tooltip: 'Stop pastoon',
    checked: false,
    enabled: true,
  }

  const systray: SysTray = new SysTrayClass({
    menu: {
      icon: '',
      title: '[P]',
      tooltip: 'pastoon — JSON → TOON clipboard converter',
      items: [
        itemToggle,
        SysTrayClass.separator,
        itemConvertNow,
        itemUndo,
        itemReverse,
        SysTrayClass.separator,
        itemQuit,
      ],
    },
    debug: false,
    copyDir: true,
  })

  systray.onClick((action: ClickEvent) => {
    const { item } = action

    if (item === itemToggle) {
      config = writeConfig({ autoConvert: !config.autoConvert })
      itemToggle.title = config.autoConvert ? '✓ Auto-convert JSON' : '  Auto-convert JSON'
      itemToggle.checked = config.autoConvert
      systray.sendAction({ type: 'update-item', item: itemToggle })
      return
    }

    if (item === itemConvertNow) {
      const text = clipboardy.readSync()
      if (isValidJson(text)) {
        lastOriginalJson = text
        const toon = toToon(text, { delimiter: config.delimiter, keyFolding: config.keyFolding })
        clipboardy.writeSync(toon)
        lastClipboard = toon
        itemUndo.enabled = true
        systray.sendAction({ type: 'update-item', item: itemUndo })
      }
      return
    }

    if (item === itemUndo) {
      if (lastOriginalJson) {
        clipboardy.writeSync(lastOriginalJson)
        lastClipboard = lastOriginalJson
        lastOriginalJson = null
        itemUndo.enabled = false
        systray.sendAction({ type: 'update-item', item: itemUndo })
      }
      return
    }

    if (item === itemReverse) {
      const text = clipboardy.readSync()
      try {
        const json = toJson(text)
        clipboardy.writeSync(json)
        lastClipboard = json
        lastOriginalJson = null
      } catch {
        // Not valid TOON — ignore
      }
      return
    }

    if (item === itemQuit) {
      clearInterval(pollInterval)
      systray.kill(false)
      process.exit(0)
    }
  })

  // Clipboard polling loop
  const pollInterval = setInterval(() => {
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
      itemUndo.enabled = true
      systray.sendAction({ type: 'update-item', item: itemUndo })
    } else {
      // New non-JSON clipboard content — clear undo buffer
      lastOriginalJson = null
      itemUndo.enabled = false
      systray.sendAction({ type: 'update-item', item: itemUndo })
    }
  }, config.pollInterval)

  // Keep process alive via systray's native binary; unref poll so it doesn't block exit
  pollInterval.unref()
}
