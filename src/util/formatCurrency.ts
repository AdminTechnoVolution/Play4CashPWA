const fmt2 = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const fmt0 = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatUSD(value: number, decimals: 0 | 2 = 2): string {
  return decimals === 0 ? fmt0.format(value) : fmt2.format(value);
}
