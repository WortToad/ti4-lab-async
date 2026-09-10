import { afterEach, describe, expect, it, vi } from "vitest";
import { appPath, appUrl, normalizeBasePath } from "./appUrl";

afterEach(() => vi.unstubAllEnvs());

describe("deployment URLs", () => {
  it("supports root hosting", () => {
    vi.stubEnv("BASE_URL", "/");
    expect(appPath("/draft/new?players=6")).toBe("/draft/new?players=6");
  });

  it("keeps assets, API requests, and private share links inside the app", () => {
    vi.stubEnv("BASE_URL", "/ti4/");
    for (const path of [
      "/logo.webp",
      "/api/draft/123/undo",
      "/draft/bag/123?key=test#seat",
    ]) {
      expect(appPath(path)).toBe(`/ti4${path}`);
    }
    expect(appPath("/")).toBe("/ti4/");
    expect(appPath("/ti4/draft/bag/123?key=test")).toBe(
      "/ti4/draft/bag/123?key=test",
    );
    expect(appPath("/ti4?key=test")).toBe("/ti4?key=test");
    expect(appPath("/ti4-other")).toBe("/ti4/ti4-other");
  });

  it("preserves external URLs, fragments, and relative links", () => {
    vi.stubEnv("BASE_URL", "/ti4/");
    for (const url of [
      "https://cdn.example/image.png",
      "//cdn.example/image.png",
      "data:image/png;base64,AA",
      "#glow",
      "../replay",
    ]) {
      expect(appPath(url)).toBe(url);
    }
  });

  it("uses this deployment's domain and path in public links", () => {
    vi.stubEnv("BASE_URL", "/ti4/");
    vi.stubEnv("VITE_PUBLIC_ORIGIN", "https://obsecsolutions.com");
    expect(appUrl("/draft/example.png")).toBe(
      "https://obsecsolutions.com/ti4/draft/example.png",
    );
  });

  it("normalizes mount paths and rejects URLs, traversal, and query strings", () => {
    expect(normalizeBasePath()).toBe("");
    expect(normalizeBasePath("/")).toBe("");
    expect(normalizeBasePath("/ti4/")).toBe("/ti4");
    for (const path of [
      "ti4",
      "https://example.com/ti4",
      "/../ti4",
      "/ti4?x=1",
      "/ti4#x",
      "//example.com",
    ]) {
      expect(() => normalizeBasePath(path)).toThrow();
    }
  });
});
