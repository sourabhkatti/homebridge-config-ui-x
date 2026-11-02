import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { DarwinInstaller } from '../../src/bin/platforms/darwin.js'
import { FreeBSDInstaller } from '../../src/bin/platforms/freebsd.js'
import { LinuxInstaller } from '../../src/bin/platforms/linux.js'

/**
 * These specs run the real service file generators of the installers. The
 * generators only differ from a real install in where they write: the paths
 * (which are under /Library, /etc and /usr/local, so need root) are pointed at
 * a temp directory, and nothing is registered with launchd, systemd or rc.
 */
describe('HbServiceInstallers (e2e)', () => {
  let outDir: string

  const hbService = (enableTerminal: boolean) => ({
    serviceName: 'Homebridge',
    selfPath: '/usr/local/lib/node_modules/homebridge-config-ui-x/dist/bin/hb-service.js',
    storagePath: '/home/example/.homebridge',
    asUser: 'example',
    enableTerminal,
    logger: { log() {}, warn() {}, error() {}, success() {} },
  }) as any

  const redirect = (installer: any, paths: Record<string, string>) => {
    for (const [name, path] of Object.entries(paths)) {
      Object.defineProperty(installer, name, { get: () => path })
    }
    return installer
  }

  const createPlist = async (enableTerminal: boolean) => {
    const plistPath = join(outDir, `darwin-${enableTerminal}.plist`)
    const installer = redirect(new DarwinInstaller(hbService(enableTerminal)), { plistPath })
    installer.user = process.env.USER || 'example'
    await installer.createLaunchAgent()
    return readFile(plistPath, 'utf8')
  }

  const createSystemdFiles = async (enableTerminal: boolean) => {
    const systemdEnvPath = join(outDir, `linux-${enableTerminal}.env`)
    const systemdServicePath = join(outDir, `linux-${enableTerminal}.service`)
    const installer = redirect(new LinuxInstaller(hbService(enableTerminal)), { systemdEnvPath, systemdServicePath })
    await installer.createSystemdEnvFile()
    await installer.createSystemdService()
    return {
      env: await readFile(systemdEnvPath, 'utf8'),
      service: await readFile(systemdServicePath, 'utf8'),
    }
  }

  const createRcFile = async (enableTerminal: boolean) => {
    const rcServicePath = join(outDir, `freebsd-${enableTerminal}.rc`)
    const installer = redirect(new FreeBSDInstaller(hbService(enableTerminal)), { rcServicePath })
    await installer.createRCService()
    return readFile(rcServicePath, 'utf8')
  }

  beforeAll(async () => {
    outDir = await mkdtemp(join(tmpdir(), 'uix-installers-'))
  })

  afterAll(async () => {
    await rm(outDir, { recursive: true, force: true })
  })

  describe('file permissions', () => {
    it('should run the macOS launch daemon with umask 077 so new files are owner-only', async () => {
      const plist = await createPlist(false)

      // launchd takes the umask as a decimal integer: 63 is 077 in octal
      expect(plist).toContain('<key>Umask</key>\n        <integer>63</integer>')
    })
  })

  describe('web terminal', () => {
    it('should not be enabled in the macOS launch daemon by default', async () => {
      const plist = await createPlist(false)

      expect(plist).toContain('<key>UIX_STORAGE_PATH</key>')
      expect(plist).not.toContain('HOMEBRIDGE_CONFIG_UI_TERMINAL')
    })

    it('should be enabled in the macOS launch daemon when requested', async () => {
      const plist = await createPlist(true)

      expect(plist).toContain('<key>HOMEBRIDGE_CONFIG_UI_TERMINAL</key>\n                <string>1</string>')
    })

    it('should not be enabled in the systemd environment file by default', async () => {
      const { env } = await createSystemdFiles(false)

      expect(env).toContain('UIX_STORAGE_PATH="/home/example/.homebridge"')
      expect(env).toContain('\n#HOMEBRIDGE_CONFIG_UI_TERMINAL=1\n')
      expect(env).not.toMatch(/^HOMEBRIDGE_CONFIG_UI_TERMINAL=1$/m)
    })

    it('should be enabled in the systemd environment file when requested', async () => {
      const { env } = await createSystemdFiles(true)

      expect(env).toMatch(/^HOMEBRIDGE_CONFIG_UI_TERMINAL=1$/m)
    })

    it('should not be enabled in the FreeBSD rc script by default', async () => {
      const rc = await createRcFile(false)

      expect(rc).toContain('export UIX_STORAGE_PATH=')
      expect(rc).not.toContain('HOMEBRIDGE_CONFIG_UI_TERMINAL')
    })

    it('should be enabled in the FreeBSD rc script when requested', async () => {
      const rc = await createRcFile(true)

      expect(rc).toContain('export HOMEBRIDGE_CONFIG_UI_TERMINAL=1\n')
    })
  })
})
