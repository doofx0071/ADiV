import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  themeColors,
  statusColors,
  statusBadgeVariants,
  getLuminance,
  getContrastRatio,
  hexToRgb,
  meetsWcagAa,
  meetsWcagAaa,
  resolveSystemTheme,
  getResolvedTheme,
  THEME_STORAGE_KEY,
  DEFAULT_THEME,
} from "@/lib/theme";

describe("themeColors", () => {
  it("has light and dark palettes", () => {
    expect(themeColors.light).toBeDefined();
    expect(themeColors.dark).toBeDefined();
  });

  it("light mode uses correct cyber-moto colors", () => {
    expect(themeColors.light.background).toBe("#f8fafc");
    expect(themeColors.light.card).toBe("#ffffff");
    expect(themeColors.light.primary).toBe("#e62025");
    expect(themeColors.light.accent).toBe("#e62025");
    expect(themeColors.light.destructive).toBe("#ef4444");
    expect(themeColors.light.success).toBe("#22c55e");
    expect(themeColors.light.warning).toBe("#f59e0b");
  });

  it("dark mode uses correct cyber-moto colors", () => {
    expect(themeColors.dark.background).toBe("#0a0a0f");
    expect(themeColors.dark.card).toBe("#13131f");
    expect(themeColors.dark.primary).toBe("#e62025");
    expect(themeColors.dark.accent).toBe("#e62025");
    expect(themeColors.dark.destructive).toBe("#dc2626");
    expect(themeColors.dark.success).toBe("#22c55e");
    expect(themeColors.dark.warning).toBe("#f59e0b");
  });

  it("light and dark have identical token keys", () => {
    const lightKeys = Object.keys(themeColors.light);
    const darkKeys = Object.keys(themeColors.dark);
    expect(lightKeys.sort()).toEqual(darkKeys.sort());
  });
});

describe("statusColors", () => {
  it("maps all maintenance statuses", () => {
    expect(statusColors.upcoming).toBeDefined();
    expect(statusColors.due).toBeDefined();
    expect(statusColors.overdue).toBeDefined();
    expect(statusColors.completed).toBeDefined();
  });

  it("upcoming is green", () => {
    expect(statusColors.upcoming.background).toBe("#22c55e");
  });

  it("due is yellow/amber", () => {
    expect(statusColors.due.background).toBe("#f59e0b");
  });

  it("overdue is red", () => {
    expect(statusColors.overdue.background).toBe("#ef4444");
  });

  it("completed is red", () => {
    expect(statusColors.completed.background).toBe("#e62025");
  });
});

describe("statusBadgeVariants", () => {
  it("maps statuses to Tailwind classes", () => {
    expect(statusBadgeVariants.upcoming).toContain("bg-success");
    expect(statusBadgeVariants.due).toContain("bg-warning");
    expect(statusBadgeVariants.overdue).toContain("bg-destructive");
    expect(statusBadgeVariants.completed).toContain("bg-primary");
  });
});

describe("hexToRgb", () => {
  it("converts 6-digit hex to RGB", () => {
    expect(hexToRgb("#ff0000")).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb("#00ff00")).toEqual({ r: 0, g: 255, b: 0 });
    expect(hexToRgb("#0000ff")).toEqual({ r: 0, g: 0, b: 255 });
  });

  it("converts 3-digit hex to RGB", () => {
    expect(hexToRgb("#f00")).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb("#0f0")).toEqual({ r: 0, g: 255, b: 0 });
  });

  it("handles hex without hash", () => {
    expect(hexToRgb("ff0000")).toEqual({ r: 255, g: 0, b: 0 });
  });

  it("returns null for invalid hex", () => {
    expect(hexToRgb("not-a-color")).toBeNull();
    expect(hexToRgb("#gggggg")).toBeNull();
  });
});

describe("getLuminance", () => {
  it("returns 0 for black", () => {
    expect(getLuminance("#000000")).toBeCloseTo(0, 5);
  });

  it("returns 1 for white", () => {
    expect(getLuminance("#ffffff")).toBeCloseTo(1, 5);
  });

  it("returns intermediate values for grays", () => {
    expect(getLuminance("#808080")).toBeGreaterThan(0.1);
    expect(getLuminance("#808080")).toBeLessThan(0.5);
  });
});

describe("getContrastRatio", () => {
  it("returns 21:1 for black on white", () => {
    expect(getContrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
  });

  it("returns 1:1 for identical colors", () => {
    expect(getContrastRatio("#ff0000", "#ff0000")).toBeCloseTo(1, 1);
  });

  it("is symmetric", () => {
    const a = getContrastRatio("#00d4ff", "#000000");
    const b = getContrastRatio("#000000", "#00d4ff");
    expect(a).toBeCloseTo(b, 5);
  });
});

describe("WCAG contrast compliance", () => {
  // Body text on page backgrounds must meet AA
  const textPairs = [
    { name: "light foreground on background", fg: themeColors.light.foreground, bg: themeColors.light.background },
    { name: "light card-foreground on card", fg: themeColors.light["card-foreground"], bg: themeColors.light.card },
    { name: "dark foreground on background", fg: themeColors.dark.foreground, bg: themeColors.dark.background },
    { name: "dark card-foreground on card", fg: themeColors.dark["card-foreground"], bg: themeColors.dark.card },
  ];

  textPairs.forEach(({ name, fg, bg }) => {
    it(`${name} meets WCAG AA (4.5:1)`, () => {
      expect(meetsWcagAa(fg, bg)).toBe(true);
    });
  });

  // Element foregrounds on their base colors (buttons, badges) must meet AA
  const elementPairs = [
    { name: "light primary-foreground on primary", fg: themeColors.light["primary-foreground"], bg: themeColors.light.primary },
    { name: "light accent-foreground on accent", fg: themeColors.light["accent-foreground"], bg: themeColors.light.accent },
    { name: "light destructive-foreground on destructive", fg: themeColors.light["destructive-foreground"], bg: themeColors.light.destructive },
    { name: "light success-foreground on success", fg: themeColors.light["success-foreground"], bg: themeColors.light.success },
    { name: "light warning-foreground on warning", fg: themeColors.light["warning-foreground"], bg: themeColors.light.warning },
    { name: "dark primary-foreground on primary", fg: themeColors.dark["primary-foreground"], bg: themeColors.dark.primary },
    { name: "dark accent-foreground on accent", fg: themeColors.dark["accent-foreground"], bg: themeColors.dark.accent },
    { name: "dark destructive-foreground on destructive", fg: themeColors.dark["destructive-foreground"], bg: themeColors.dark.destructive },
    { name: "dark success-foreground on success", fg: themeColors.dark["success-foreground"], bg: themeColors.dark.success },
    { name: "dark warning-foreground on warning", fg: themeColors.dark["warning-foreground"], bg: themeColors.dark.warning },
  ];

  elementPairs.forEach(({ name, fg, bg }) => {
    it(`${name} meets WCAG AA (4.5:1)`, () => {
      expect(meetsWcagAa(fg, bg)).toBe(true);
    });
  });

  // Body text should ideally meet AAA
  const aaaPairs = [
    { name: "light foreground on background", fg: themeColors.light.foreground, bg: themeColors.light.background },
    { name: "light card-foreground on card", fg: themeColors.light["card-foreground"], bg: themeColors.light.card },
    { name: "dark foreground on background", fg: themeColors.dark.foreground, bg: themeColors.dark.background },
    { name: "dark card-foreground on card", fg: themeColors.dark["card-foreground"], bg: themeColors.dark.card },
  ];

  aaaPairs.forEach(({ name, fg, bg }) => {
    it(`${name} meets WCAG AAA (7:1)`, () => {
      expect(meetsWcagAaa(fg, bg)).toBe(true);
    });
  });
});

describe("resolveSystemTheme", () => {
  let matchMediaMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    matchMediaMock = vi.fn();
    globalThis.matchMedia = matchMediaMock as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns dark when prefers-color-scheme is dark", () => {
    matchMediaMock.mockReturnValue({ matches: true });
    expect(resolveSystemTheme()).toBe("dark");
  });

  it("returns light when prefers-color-scheme is not dark", () => {
    matchMediaMock.mockReturnValue({ matches: false });
    expect(resolveSystemTheme()).toBe("light");
  });
});

describe("getResolvedTheme", () => {
  beforeEach(() => {
    globalThis.matchMedia = vi.fn().mockReturnValue({ matches: false }) as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns light for light theme", () => {
    expect(getResolvedTheme("light")).toBe("light");
  });

  it("returns dark for dark theme", () => {
    expect(getResolvedTheme("dark")).toBe("dark");
  });

  it("returns system-resolved value for system theme", () => {
    const result = getResolvedTheme("system");
    expect(result).toMatch(/^(light|dark)$/);
  });
});

describe("constants", () => {
  it("has correct storage key", () => {
    expect(THEME_STORAGE_KEY).toBe("adiv-theme");
  });

  it("defaults to light theme", () => {
    expect(DEFAULT_THEME).toBe("light");
  });
});
