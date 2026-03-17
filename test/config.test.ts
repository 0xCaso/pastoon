import { describe, it, expect } from 'vitest'
import { readConfig, writeConfig, DEFAULT_CONFIG } from '../src/config.js'

describe('DEFAULT_CONFIG', () => {
  it('has expected defaults', () => {
    expect(DEFAULT_CONFIG.autoConvert).toBe(true)
    expect(DEFAULT_CONFIG.delimiter).toBe(',')
    expect(DEFAULT_CONFIG.keyFolding).toBe('off')
    expect(DEFAULT_CONFIG.notifications).toBe(true)
    expect(DEFAULT_CONFIG.pollInterval).toBe(300)
  })
})
