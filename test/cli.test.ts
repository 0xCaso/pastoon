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
      { encoding: 'utf8' },
    )
    expect(output).toContain('Alice')
    expect(output).toContain('admin')
    // TOON should not contain JSON braces
    expect(output).not.toContain('{"name"')
  })

  it('--pipe passes through non-JSON unchanged', () => {
    const output = execSync(`echo 'hello world' | node dist/cli.js --pipe`, {
      encoding: 'utf8',
    })
    expect(output.trim()).toBe('hello world')
  })

  it('--llms outputs command manifest', () => {
    const output = run('--llms')
    expect(output).toContain('pastoon')
    expect(output).toContain('setup')
  })
})
