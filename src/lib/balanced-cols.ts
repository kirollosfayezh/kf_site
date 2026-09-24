/**
 * How many columns `n` cards should use when anywhere from `min` to `max`
 * fit at the current breakpoint.
 *
 * An auto-fit grid picks its column count from the width alone, so the item
 * count decides what the last row looks like: 5 cards in 4 columns strands
 * one, 6 in 4 leaves two holes. The counts here come from the CMS and change,
 * so the choice has to be made from the count. Ranked, in order, by:
 *
 *   1. fewest rows — never trade a shorter page for a tidier last row
 *   2. no single stray card on the last row
 *   3. fewest empty slots
 *
 * so 6 cards take 3+3 rather than 4+2, 5 take 3+2 rather than 4+1, but 8 in
 * a 3-to-2 range stay 3+3+2 rather than stretch to four rows of two.
 */
export function pickCols(n: number, max: number, min: number = max): number {
  // Everything fits on one row. Never go below two across, or a single card
  // would stretch to the full container width.
  if (n <= max) return Math.max(n, Math.min(2, max));

  let best = max;
  let bestKey: readonly number[] | null = null;
  for (let c = max; c >= Math.max(1, min); c--) {
    const rem = n % c;
    const key = [Math.ceil(n / c), rem === 1 ? 1 : 0, rem === 0 ? 0 : c - rem];
    if (!bestKey || isLess(key, bestKey)) {
      best = c;
      bestKey = key;
    }
  }
  return best;
}

function isLess(a: readonly number[], b: readonly number[]): boolean {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] < b[i];
  }
  return false;
}
