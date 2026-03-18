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
