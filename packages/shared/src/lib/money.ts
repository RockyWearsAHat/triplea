const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatUsd(amount: number): string {
  if (!Number.isFinite(amount)) return "—";
  return usd.format(amount);
}

export function formatUsdOrFree(amount: number, freeLabel = "Free"): string {
  if (!Number.isFinite(amount)) return "—";
  if (amount === 0) return freeLabel;
  return formatUsd(amount);
}
