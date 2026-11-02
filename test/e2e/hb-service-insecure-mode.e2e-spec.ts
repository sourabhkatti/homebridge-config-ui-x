import { describe, expect, it } from 'vitest'

import { isInsecureModeEnabled } from '../../src/bin/insecure-mode.js'

describe('HbServiceInsecureMode (e2e)', () => {
  describe('outside docker', () => {
    it('should be off when there are no startup options', () => {
      expect(isInsecureModeEnabled(undefined, false, {})).toBe(false)
      expect(isInsecureModeEnabled(null, false, {})).toBe(false)
    })

    it('should be off when the startup options do not set insecureMode', () => {
      expect(isInsecureModeEnabled({}, false, {})).toBe(false)
    })

    it('should be off when insecureMode is false', () => {
      expect(isInsecureModeEnabled({ insecureMode: false }, false, {})).toBe(false)
    })

    it('should be on only when insecureMode is true', () => {
      expect(isInsecureModeEnabled({ insecureMode: true }, false, {})).toBe(true)
    })

    it('should be off when insecureMode is not a boolean', () => {
      for (const insecureMode of ['true', '1', 1, null]) {
        expect(isInsecureModeEnabled({ insecureMode }, false, {})).toBe(false)
      }
    })

    it('should ignore the docker HOMEBRIDGE_INSECURE flag', () => {
      expect(isInsecureModeEnabled(undefined, false, { HOMEBRIDGE_INSECURE: '1' })).toBe(false)
      expect(isInsecureModeEnabled({}, false, { HOMEBRIDGE_INSECURE: '1' })).toBe(false)
    })
  })

  describe('in docker', () => {
    it('should be off when HOMEBRIDGE_INSECURE is not set', () => {
      expect(isInsecureModeEnabled(undefined, true, {})).toBe(false)
      expect(isInsecureModeEnabled({}, true, {})).toBe(false)
    })

    it('should be off when HOMEBRIDGE_INSECURE is not 1', () => {
      expect(isInsecureModeEnabled(undefined, true, { HOMEBRIDGE_INSECURE: '0' })).toBe(false)
      expect(isInsecureModeEnabled(undefined, true, { HOMEBRIDGE_INSECURE: 'true' })).toBe(false)
    })

    it('should follow HOMEBRIDGE_INSECURE when there are no startup options', () => {
      expect(isInsecureModeEnabled(undefined, true, { HOMEBRIDGE_INSECURE: '1' })).toBe(true)
    })

    it('should follow HOMEBRIDGE_INSECURE when the startup options do not set insecureMode', () => {
      expect(isInsecureModeEnabled({}, true, { HOMEBRIDGE_INSECURE: '1' })).toBe(true)
    })

    it('should let the startup options override HOMEBRIDGE_INSECURE', () => {
      expect(isInsecureModeEnabled({ insecureMode: false }, true, { HOMEBRIDGE_INSECURE: '1' })).toBe(false)
      expect(isInsecureModeEnabled({ insecureMode: true }, true, {})).toBe(true)
    })
  })
})
