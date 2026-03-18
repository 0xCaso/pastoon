#!/usr/bin/env node
import { Cli, z } from 'incur'
import clipboardy from 'clipboardy'
import { execSync } from 'node:child_process'
import { rmSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { isValidJson, toToon, toJson } from './core.js'
import { installLaunchAgent, uninstallLaunchAgent } from './launchagent.js'
import { readConfig } from './config.js'
import { startTray } from './tray.js'
import { jsonToToonHandler, toonToJsonHandler } from './mcp.js'

const PLIST_LABEL = 'com.pastoon'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8')) as {
  version: string
}

const cli = Cli.create('pastoon', {
  version: pkg.version,
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
      return startTray() // async; awaiting ready() keeps the process alive via the systray child process
    }

    // --pipe: stdin → stdout conversion
    if (c.options.pipe) {
      const chunks: Buffer[] = []
      process.stdin.on('data', (chunk: Buffer) => chunks.push(chunk))
      process.stdin.on('end', () => {
        const input = Buffer.concat(chunks).toString('utf8').trim()
        if (c.options.reverse) {
          // TOON → JSON
          try {
            process.stdout.write(toJson(input) + '\n')
          } catch {
            process.stderr.write('pastoon: input is not valid TOON\n')
            process.exit(1)
          }
        } else if (isValidJson(input)) {
          // JSON → TOON
          process.stdout.write(
            toToon(input, { delimiter: cfg.delimiter, keyFolding: cfg.keyFolding }) + '\n',
          )
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
    let text: string
    try {
      text = clipboardy.readSync()
    } catch {
      return { converted: false, error: 'Could not read clipboard (headless or unsupported environment)' }
    }
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

cli.command('json-to-toon', {
  description:
    'Convert a JSON string to TOON format (40% fewer tokens). Use before including large JSON data in reasoning context.',
  args: z.object({
    json: z.string().describe('JSON string to convert'),
  }),
  options: z.object({
    delimiter: z
      .enum([',', '\t', '|'])
      .optional()
      .describe('Field delimiter (default: ,)'),
    keyFolding: z
      .enum(['off', 'safe'])
      .optional()
      .describe('Key folding mode (default: off)'),
  }),
  run(c) {
    return jsonToToonHandler({
      json: c.args.json,
      delimiter: c.options.delimiter as ',' | '\t' | '|' | undefined,
      keyFolding: c.options.keyFolding as 'off' | 'safe' | undefined,
    })
  },
})

cli.command('toon-to-json', {
  description: 'Convert a TOON string back to JSON.',
  args: z.object({
    toon: z.string().describe('TOON string to decode'),
  }),
  run(c) {
    return toonToJsonHandler({ toon: c.args.toon })
  },
})

cli.serve()
