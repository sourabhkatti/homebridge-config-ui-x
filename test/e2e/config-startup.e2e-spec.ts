import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { getStartupConfig } from '../../src/core/config/config.startup.js'

describe('ConfigStartup (e2e)', () => {
  const envKeys = ['UIX_CONFIG_PATH', 'UIX_DEVELOPMENT', 'UIX_DEBUG_LOGGING', 'HOMEBRIDGE_CONFIG_UI']
  const originalEnv: Record<string, string | undefined> = {}

  let configDir: string

  const startupConfigFor = async (platforms?: Array<Record<string, unknown>>) => {
    const configPath = join(configDir, 'config.json')
    await writeFile(configPath, JSON.stringify({ bridge: {}, accessories: [], platforms }))
    process.env.UIX_CONFIG_PATH = configPath
    return getStartupConfig()
  }

  beforeAll(async () => {
    configDir = await mkdtemp(join(tmpdir(), 'uix-startup-config-'))
  })

  afterAll(async () => {
    await rm(configDir, { recursive: true, force: true })
  })

  beforeEach(() => {
    for (const key of envKeys) {
      originalEnv[key] = process.env[key]
    }
    delete process.env.UIX_DEVELOPMENT
    delete process.env.HOMEBRIDGE_CONFIG_UI
  })

  afterEach(() => {
    for (const key of envKeys) {
      if (originalEnv[key] === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = originalEnv[key]
      }
    }
  })

  describe('host', () => {
    it('should only listen on the loopback interface when there is no config platform block', async () => {
      expect((await startupConfigFor([])).host).toBe('127.0.0.1')
      expect((await startupConfigFor(undefined)).host).toBe('127.0.0.1')
    })

    it('should only listen on the loopback interface when the config platform has no host', async () => {
      const config = await startupConfigFor([{ platform: 'config', name: 'Config', port: 8581 }])

      expect(config.host).toBe('127.0.0.1')
    })

    it('should only listen on the loopback interface when the host is empty', async () => {
      const config = await startupConfigFor([{ platform: 'config', name: 'Config', port: 8581, host: '' }])

      expect(config.host).toBe('127.0.0.1')
    })

    it.each(['0.0.0.0', '::', '192.168.1.20', '::1'])('should listen on the configured host %s', async (host) => {
      const config = await startupConfigFor([{ platform: 'config', name: 'Config', port: 8581, host }])

      expect(config.host).toBe(host)
    })

    it('should listen on every interface in docker unless a host is configured', async () => {
      process.env.HOMEBRIDGE_CONFIG_UI = '1'

      expect(['::', '0.0.0.0']).toContain((await startupConfigFor([{ platform: 'config', name: 'Config' }])).host)
      expect((await startupConfigFor([{ platform: 'config', name: 'Config', host: '192.168.1.20' }])).host).toBe('192.168.1.20')
    })

    it('should listen on every interface in development mode and ignore the configured host', async () => {
      process.env.UIX_DEVELOPMENT = '1'

      expect(['::', '0.0.0.0']).toContain((await startupConfigFor([{ platform: 'config', name: 'Config' }])).host)
      expect(['::', '0.0.0.0']).toContain((await startupConfigFor([{ platform: 'config', name: 'Config', host: '127.0.0.1' }])).host)
    })
  })
})
