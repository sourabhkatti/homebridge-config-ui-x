/**
 * Setup codes that HomeKit refuses, besides the ones made of a single repeated
 * digit (000-00-000, 111-11-111, ...).
 */
const INVALID_PIN_DIGITS = new Set(['12345678', '87654321'])

/**
 * A uniformly distributed random integer from 0 up to, but not including, `max`.
 *
 * This is the browser counterpart of `crypto.randomInt` in Node.js, which is
 * not available here: it draws from the Web Crypto CSPRNG and throws away the
 * values that would make the low numbers more likely than the high ones.
 *
 * @param max - the exclusive upper bound, at most 2 ** 32
 */
function randomInt(max: number): number {
  const range = 2 ** 32
  const limit = range - (range % max)
  const value = new Uint32Array(1)

  do {
    crypto.getRandomValues(value)
  } while (value[0] >= limit)

  return value[0] % max
}

/**
 * Generate a random HomeKit setup code in the `XXX-XX-XXX` format Homebridge
 * expects for a bridge `pin`, avoiding the codes HAP rejects.
 *
 * A child bridge without a `pin` of its own is paired with the main bridge's
 * setup code, so every child bridge the UI creates is given a unique one.
 */
export function generateHapPin(): string {
  let digits: string

  do {
    digits = randomInt(10 ** 8).toString().padStart(8, '0')
  } while (new Set(digits).size === 1 || INVALID_PIN_DIGITS.has(digits))

  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`
}
