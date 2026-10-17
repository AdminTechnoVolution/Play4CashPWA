import { describe, expect, it } from 'vitest';
import { formatUsdt, suggestedDepositAmounts } from './PaymentUi';

describe('formatUsdt', () => {
  it('groups thousands and keeps at least two decimals', () => {
    expect(formatUsdt('1000.000000')).toBe('1,000.00');
    expect(formatUsdt('12.040000')).toBe('12.04');
    expect(formatUsdt('1234567.891000')).toBe('1,234,567.891');
    expect(formatUsdt('100')).toBe('100.00');
    expect(formatUsdt(undefined)).toBe('0.00');
  });

  it('keeps every digit of amounts beyond Number precision', () => {
    expect(formatUsdt('999999999999999999.999999')).toBe('999,999,999,999,999,999.999999');
  });
});

describe('suggestedDepositAmounts', () => {
  it('starts at least 2 USDT above the network minimum, rounded up to a multiple of 5', () => {
    expect(suggestedDepositAmounts('12.13')).toEqual(['15', '25', '50', '100']);
    expect(suggestedDepositAmounts('12.05')).toEqual(['15', '25', '50', '100']);
    expect(suggestedDepositAmounts('13.75')).toEqual(['20', '25', '50', '100']);
    expect(suggestedDepositAmounts('13')).toEqual(['15', '25', '50', '100']);
    expect(suggestedDepositAmounts('24')).toEqual(['30', '50', '100', '250']);
  });

  it('keeps the default ladder while the minimum is unknown', () => {
    expect(suggestedDepositAmounts(undefined)).toEqual(['10', '25', '50', '100']);
    expect(suggestedDepositAmounts('abc')).toEqual(['10', '25', '50', '100']);
  });
});
