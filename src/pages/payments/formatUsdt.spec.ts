import { describe, expect, it } from 'vitest';
import { formatUsdt } from './PaymentUi';

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
