import { LADDER_ZAT } from "./constants.ts";

/** Whether `zat` is exactly one of the standard amounts. */
export function isCanonical(zat: number): boolean {
  return (LADDER_ZAT as readonly number[]).includes(zat);
}

/** The standard sizes a wallet could be funded with now, given what can be spent and the fee. */
export function fundableSizes(spendableZat: number, feeZat: number): number[] {
  return LADDER_ZAT.filter((size) => size + feeZat <= spendableZat);
}

/**
 * Splits an amount into standard pieces, largest first, for sizes above 1 ZEC or between steps
 * (0.35 ZEC → 0.2 + 0.1 + 0.05). Whatever is below the smallest step is left over.
 */
export function decompose(zat: number): { pieces: number[]; leftover: number } {
  const pieces: number[] = [];
  let rest = zat;
  for (const size of [...LADDER_ZAT].reverse()) {
    while (rest >= size) {
      pieces.push(size);
      rest -= size;
    }
  }
  return { pieces, leftover: rest };
}
