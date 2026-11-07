/** Balances within half a cent are treated as equal (string → float rounding). */
export function balancesMatch(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.005;
}
