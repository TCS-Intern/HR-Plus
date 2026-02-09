import { cn, formatCurrency, formatPercentage, formatDate, formatShortDate } from "@/lib/utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("px-2", "py-1")).toBe("px-2 py-1");
  });

  it("handles empty input", () => {
    expect(cn()).toBe("");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "extra")).toBe("base extra");
  });

  it("deduplicates conflicting Tailwind utilities", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
});

describe("formatCurrency", () => {
  it("formats USD by default", () => {
    expect(formatCurrency(120000)).toBe("$120,000");
  });

  it("formats zero", () => {
    expect(formatCurrency(0)).toBe("$0");
  });

  it("formats large amounts with commas", () => {
    expect(formatCurrency(1500000)).toBe("$1,500,000");
  });

  it("formats with different currency", () => {
    const result = formatCurrency(50000, "EUR");
    expect(result).toContain("50,000");
  });

  it("removes decimal places", () => {
    expect(formatCurrency(99999.99)).toBe("$100,000");
  });
});

describe("formatPercentage", () => {
  it("formats a whole number", () => {
    expect(formatPercentage(85)).toBe("85%");
  });

  it("rounds decimals", () => {
    expect(formatPercentage(85.7)).toBe("86%");
  });

  it("handles zero", () => {
    expect(formatPercentage(0)).toBe("0%");
  });

  it("handles 100", () => {
    expect(formatPercentage(100)).toBe("100%");
  });
});

describe("formatDate", () => {
  it("formats a date string to long format", () => {
    const result = formatDate("2025-03-15");
    expect(result).toContain("March");
    expect(result).toContain("15");
    expect(result).toContain("2025");
  });

  it("formats a Date object", () => {
    const result = formatDate(new Date(2025, 0, 1));
    expect(result).toContain("January");
    expect(result).toContain("2025");
  });
});

describe("formatShortDate", () => {
  it("formats a date to short format", () => {
    const result = formatShortDate("2025-06-20");
    expect(result).toContain("Jun");
    expect(result).toContain("20");
    expect(result).toContain("2025");
  });

  it("formats a Date object", () => {
    const result = formatShortDate(new Date(2025, 11, 25));
    expect(result).toContain("Dec");
    expect(result).toContain("25");
    expect(result).toContain("2025");
  });
});
