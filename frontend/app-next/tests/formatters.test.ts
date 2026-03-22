import { formatGameTime, formatPercent, formatStartTime, getRaceLetter } from "@/lib/utils/format";

describe("formatters", () => {
  it("formats game time as mm:ss", () => {
    expect(formatGameTime(835)).toBe("13:55");
  });

  it("formats percentages with one decimal place", () => {
    expect(formatPercent(55.83)).toBe("55.8%");
  });

  it("normalizes race names to short letters", () => {
    expect(getRaceLetter("Protoss")).toBe("P");
    expect(getRaceLetter("Terran")).toBe("T");
    expect(getRaceLetter("Zerg")).toBe("Z");
  });

  it("formats ISO-like start times without losing the date", () => {
    expect(formatStartTime("2026-03-22 00:05:48")).toContain("2026-03-22");
  });
});
