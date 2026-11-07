/** Formats an amount in an ISO currency (any case), with a fallback for unknown codes. */
export function formatMoney(amount: number, currency: string, signed = false): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
      signDisplay: signed ? "exceptZero" : "auto",
    }).format(amount);
  } catch {
    // Unknown currency code — fall back to a plain number with the code.
    const n = amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      signDisplay: signed ? "exceptZero" : "auto",
    });
    return `${n} ${currency.toUpperCase()}`;
  }
}
