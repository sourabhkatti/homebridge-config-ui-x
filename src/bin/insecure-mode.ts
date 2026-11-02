import type process from 'node:process'

/**
 * Whether Homebridge should be started in insecure mode (the `-I` flag).
 *
 * Insecure mode lets the UI control accessories without pairing, so it is off
 * unless it was explicitly turned on: `insecureMode: true` in the startup
 * options file that the UI writes. The old `homebridge/homebridge` docker
 * variable (`HOMEBRIDGE_INSECURE=1`) is still honoured, but only when running
 * in docker and when the startup options do not say either way.
 */
export function isInsecureModeEnabled(
  startupOptions: { insecureMode?: unknown } | null | undefined,
  docker: boolean,
  env: typeof process.env,
): boolean {
  if (typeof startupOptions?.insecureMode === 'boolean') {
    return startupOptions.insecureMode
  }

  return docker === true && env.HOMEBRIDGE_INSECURE === '1'
}
