import { describe, expect, it } from "vitest";
import {
  formatInr, formatInrCrore, formatMultiple, formatNumberIN, formatPercent, formatPoints, groupIndian,
} from "./indian";

describe("groupIndian / formatNumberIN", () => {
  it("groups digits the Indian way", () => {
    expect(groupIndian("1")).toBe("1");
    expect(groupIndian("999")).toBe("999");
    expect(groupIndian("1000")).toBe("1,000");
    expect(groupIndian("100000")).toBe("1,00,000");
    expect(groupIndian("12345678")).toBe("1,23,45,678");
    expect(groupIndian("1234567890")).toBe("1,23,45,67,890");
  });

  it("formats with fixed decimals and an ASCII minus", () => {
    expect(formatNumberIN(1234567.891, 2)).toBe("12,34,567.89");
    expect(formatNumberIN(52140, 0)).toBe("52,140");
    expect(formatNumberIN(-1234.5, 1)).toBe("-1,234.5");
    expect(formatNumberIN(0, 2)).toBe("0.00");
    expect(formatNumberIN(-0.004, 2)).toBe("0.00");
    expect(formatNumberIN(1.005, 2)).toBe("1.01");
    expect(formatNumberIN(2.5, 0)).toBe("3");
  });

  it("renders non-finite input as a dash", () => {
    expect(formatNumberIN(Number.NaN, 2)).toBe("—");
    expect(formatNumberIN(Infinity, 2)).toBe("—");
  });

  it("never falls back to exponent notation for very large values", () => {
    expect(formatNumberIN(1e21, 0)).toBe("1,00,00,00,00,00,00,00,00,00,000");
    expect(formatNumberIN(-2e21, 1)).toBe("-2,00,00,00,00,00,00,00,00,00,000.0");
  });
});

describe("formatInrCrore", () => {
  it("matches the spec examples", () => {
    expect(formatInrCrore(192000)).toBe("₹1.92 lakh Cr");
    expect(formatInrCrore(52140)).toBe("₹52,140 Cr");
  });

  it("switches to lakh crore from 1,00,000 Cr", () => {
    expect(formatInrCrore(99999)).toBe("₹99,999 Cr");
    expect(formatInrCrore(99999.6)).toBe("₹1.00 lakh Cr");
    expect(formatInrCrore(100000)).toBe("₹1.00 lakh Cr");
    expect(formatInrCrore(1234567)).toBe("₹12.35 lakh Cr");
    expect(formatInrCrore(15_000_000)).toBe("₹150.00 lakh Cr");
    expect(formatInrCrore(250_000_000)).toBe("₹2,500.00 lakh Cr");
  });

  it("handles negatives, zero, decimals and non-finite values", () => {
    expect(formatInrCrore(-4520)).toBe("-₹4,520 Cr");
    expect(formatInrCrore(-0.2)).toBe("₹0 Cr");
    expect(formatInrCrore(0)).toBe("₹0 Cr");
    expect(formatInrCrore(12.345, 2)).toBe("₹12.35 Cr");
    expect(formatInrCrore(-250000)).toBe("-₹2.50 lakh Cr");
    expect(formatInrCrore(Number.NaN)).toBe("—");
  });
});

describe("other units", () => {
  it("formats rupees, percent, points and multiples", () => {
    expect(formatInr(1210.5)).toBe("₹1,210.50");
    expect(formatInr(-3.2)).toBe("-₹3.20");
    expect(formatPercent(22.43)).toBe("22.4%");
    expect(formatPercent(-5, 0)).toBe("-5%");
    expect(formatPoints(1.2)).toBe("+1.2 pp");
    expect(formatPoints(-0.54)).toBe("-0.5 pp");
    expect(formatPoints(0)).toBe("0.0 pp");
    expect(formatPoints(0.01)).toBe("0.0 pp");
    expect(formatMultiple(24.53)).toBe("24.5x");
    expect(formatMultiple(0, 2)).toBe("0.00x");
  });
});
