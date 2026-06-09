import { describe, it, expect } from 'vitest';
import { calibrateCosine } from '../cosineCalibration';

describe('calibrateCosine', () => {
  it('maps anchor points exactly', () => {
    expect(calibrateCosine(0.30)).toBe(10);
    expect(calibrateCosine(0.50)).toBe(50);
    expect(calibrateCosine(0.65)).toBe(75);
    expect(calibrateCosine(0.75)).toBe(90);
    expect(calibrateCosine(0.85)).toBe(100);
  });

  it('interpolates linearly between anchors', () => {
    // halfway between 0.50(50) and 0.65(75) is 0.575 -> 62.5 -> 63 (rounded)
    expect(calibrateCosine(0.575)).toBe(63);
  });

  it('clamps below the lowest anchor', () => {
    expect(calibrateCosine(0.0)).toBe(10);
    expect(calibrateCosine(-0.2)).toBe(10);
  });

  it('clamps above the highest anchor', () => {
    expect(calibrateCosine(0.95)).toBe(100);
    expect(calibrateCosine(1.0)).toBe(100);
  });
});
