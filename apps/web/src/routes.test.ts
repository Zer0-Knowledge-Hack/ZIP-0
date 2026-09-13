/**
 * These assertions matter more once the app is deployed than they did locally.
 *
 * Cloudflare Pages serves index.html for every path (see public/_redirects), because a single-page
 * app has no server-side routes. That makes pageFromPath the only thing deciding what a visitor
 * sees when they open a shared link or reload a deep page. A mistake here does not surface in
 * development, where navigation always starts at "/" and goes through the router.
 */
import { describe, expect, it } from "vitest";
import { PATHS, isKnownPath, pageFromPath, pathForPage, type AppPage } from "./routes";

const pages = Object.keys(PATHS) as AppPage[];

describe("deep links", () => {
  it("resolves every published path back to its own page", () => {
    for (const page of pages) {
      expect(pageFromPath(PATHS[page])).toBe(page);
    }
  });

  it("round-trips page to path and back", () => {
    for (const page of pages) {
      expect(pageFromPath(pathForPage(page))).toBe(page);
    }
  });

  it("tolerates a trailing slash", () => {
    // Browsers and link previews add these freely; a 404-looking landing page is the failure.
    expect(pageFromPath("/app/")).toBe("overview");
    expect(pageFromPath("/legal/")).toBe("legal");
    expect(pageFromPath("/app/pay/")).toBe("newPayment");
  });

  it("keeps /app subpaths distinct from the overview", () => {
    // "/app" is a prefix of every other product path, so ordering inside pageFromPath decides
    // this. If the overview check ran first, every product link would open the overview.
    expect(pageFromPath("/app/pay")).toBe("newPayment");
    expect(pageFromPath("/app/activity")).toBe("activity");
    expect(pageFromPath("/app/help")).toBe("help");
    expect(pageFromPath("/app/profile")).toBe("profile");
  });

  it("sends unknown paths to the landing rather than a blank shell", () => {
    expect(pageFromPath("/does-not-exist")).toBe("landing");
    expect(pageFromPath("/legalese")).toBe("landing");
    expect(pageFromPath("/appointments")).toBe("landing");
  });

  it("recognises exactly the published paths", () => {
    for (const page of pages) expect(isKnownPath(PATHS[page])).toBe(true);
    expect(isKnownPath("/does-not-exist")).toBe(false);
    expect(isKnownPath("/app/")).toBe(false);
  });
});
