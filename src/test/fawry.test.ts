import { describe, expect, it } from 'vitest';
import { sha256Hex, money } from '@/lib/fawry.server';
import { formatFawryCode } from '@/lib/payment';

describe('Fawry helpers', () => {
  it('signs with SHA-256 hex like Fawry expects', async () => {
    // Known SHA-256 of "abc"
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('always sends amounts with two decimals (part of the signature)', () => {
    expect(money(4500)).toBe('4500.00');
    expect(money(3200.5)).toBe('3200.50');
  });

  it('groups the payment code in blocks of three for the counter', () => {
    expect(formatFawryCode('963455678')).toBe('963 455 678');
  });
});
