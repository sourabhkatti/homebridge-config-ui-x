import { afterEach, describe, expect, it, vi } from 'vitest'

import { generateHapPin } from '@/app/core/helpers/hap-pin.helper'

/**
 * The setup code of every child bridge the UI creates. Homebridge uses it
 * verbatim, and HomeKit refuses a handful of codes outright, so the shape and
 * the exclusions matter as much as the randomness.
 */
describe('generateHapPin', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  /**
   * Make the CSPRNG hand out the given values, one per draw.
   * @param values - the 32 bit values to return, in order
   */
  function drawsFrom(...values: number[]) {
    const queue = [...values]
    return vi.spyOn(crypto, 'getRandomValues').mockImplementation(((array: Uint32Array) => {
      if (!queue.length) {
        throw new Error('the pin generator asked for more random values than expected')
      }
      array[0] = queue.shift()!
      return array
    }) as typeof crypto.getRandomValues)
  }

  it('produces the XXX-XX-XXX format', () => {
    for (let i = 0; i < 500; i += 1) {
      expect(generateHapPin()).toMatch(/^\d{3}-\d{2}-\d{3}$/)
    }
  })

  it('does not repeat itself', () => {
    const pins = new Set(Array.from({ length: 1000 }, () => generateHapPin()))

    // 1000 draws from 10^8 codes: a collision here is a 0.5% fluke, ten is a bug
    expect(pins.size).toBeGreaterThan(990)
  })

  it('draws from the crypto random source, never Math.random', () => {
    const random = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random is not a CSPRNG')
    })
    const getRandomValues = drawsFrom(12345)

    expect(generateHapPin()).toBe('000-12-345')
    expect(getRandomValues).toHaveBeenCalledTimes(1)
    expect(random).not.toHaveBeenCalled()
  })

  it('pads with leading zeros', () => {
    drawsFrom(7)

    expect(generateHapPin()).toBe('000-00-007')
  })

  it('never returns a code made of one repeated digit', () => {
    const allSame = [0, 11111111, 22222222, 33333333, 44444444, 55555555, 66666666, 77777777, 88888888, 99999999]
    const getRandomValues = drawsFrom(...allSame, 2468)

    expect(generateHapPin()).toBe('000-02-468')
    expect(getRandomValues).toHaveBeenCalledTimes(allSame.length + 1)
  })

  it('never returns the two sequential codes HomeKit rejects', () => {
    const getRandomValues = drawsFrom(12345678, 87654321, 13579)

    expect(generateHapPin()).toBe('000-13-579')
    expect(getRandomValues).toHaveBeenCalledTimes(3)
  })

  it('still returns the codes next to the rejected ones', () => {
    drawsFrom(12345679)
    expect(generateHapPin()).toBe('123-45-679')

    drawsFrom(87654322)
    expect(generateHapPin()).toBe('876-54-322')
  })

  it('throws away values that would bias the result towards low codes', () => {
    // 2^32 is not a multiple of 10^8: values from 4.2 billion upwards would make
    // the codes 0 to 94,967,295 slightly more likely than the rest
    const getRandomValues = drawsFrom(2 ** 32 - 1, 4_200_000_000, 4_199_999_998)

    expect(generateHapPin()).toBe('999-99-998')
    expect(getRandomValues).toHaveBeenCalledTimes(3)
  })
})
