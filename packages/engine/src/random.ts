const UINT32_BITS = 32;
const UINT32_RANGE = 2 ** UINT32_BITS;

/** A uniform number in [0, 1) from the platform's cryptographic random source. */
export function cryptoRandom(): number {
  const [v] = crypto.getRandomValues(new Uint32Array(1));
  return (v ?? 0) / UINT32_RANGE;
}

/** A uniform integer-millisecond delay in [min, max]. */
export function between(min: number, max: number, rand: () => number = cryptoRandom): number {
  return Math.round(min + (max - min) * rand());
}
