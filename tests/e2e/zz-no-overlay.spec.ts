/**
 * Site-wide check of the house rule: no text, badge or UI is drawn over comic art,
 * covers or card art. Runs last (file name) so the other journeys have created content.
 * For every visible image on each page, the top element at nine points across it must be
 * the image itself (or something inside the image's own figure that holds no text).
 */
import { expect, test, type Page } from "@playwright/test";

const stamp = Date.now().toString(36);
const VIEWER = { email: `viewer-${stamp}@toon.test`, name: "Vera Viewer", password: "viewer password 123" };

const PAGES = ["/", "/comics", "/shows", "/series", "/community", "/library", "/play", "/play/collection", "/play/packs"];

/** Returns "page: tag.class" for every point where something other than the art is on top. */
async function overlaps(page: Page): Promise<{ checked: number; out: string[] }> {
  return page.evaluate(() => {
    const out: string[] = [];
    let checked = 0;
    for (const img of Array.from(document.querySelectorAll("img"))) {
      const r = img.getBoundingClientRect();
      if (r.width < 48 || r.height < 48) continue; // icons and logos, not art
      const style = getComputedStyle(img);
      if (style.visibility === "hidden" || style.display === "none") continue;
      img.scrollIntoView({ block: "center" });
      const b = img.getBoundingClientRect();
      const top = Math.max(0, b.top), bottom = Math.min(innerHeight, b.bottom);
      if (bottom - top < 24) continue;
      checked++;
      for (const fx of [0.05, 0.5, 0.95]) for (const fy of [0.05, 0.5, 0.95]) {
        const hit = document.elementFromPoint(b.left + b.width * fx, top + (bottom - top) * fy);
        if (!hit || hit === img) continue;
        // Allowed: a wrapper the image sits in (e.g. a link) only if it carries no text of its own over the art.
        if (hit.contains(img) && !(hit.textContent ?? "").trim()) continue;
        out.push(`${img.getAttribute("src")} covered by ${hit.tagName.toLowerCase()}.${String(hit.className)}`);
      }
    }
    return { checked, out };
  });
}

test("nothing is drawn over art, covers or cards anywhere", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/signup");
  await page.getByLabel("Display name").fill(VIEWER.name);
  await page.getByLabel("Email").fill(VIEWER.email);
  await page.getByLabel("Password").fill(VIEWER.password);
  await page.getByLabel(/I am 18 or older/).check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();

  const urls = [...PAGES];
  // Also open the first fan comic (/c/…) and the first published issue, if the other journeys made them.
  await page.goto("/community");
  const fan = await page.locator('a[href^="/c/"]').first().getAttribute("href", { timeout: 3000 }).catch(() => null);
  if (fan) urls.push(fan);
  await page.goto("/comics");
  const issue = await page.locator('a[href^="/read/"]').first().getAttribute("href", { timeout: 3000 }).catch(() => null);
  if (issue) urls.push(issue);

  const problems: string[] = [];
  let checked = 0;
  for (const url of urls) {
    await page.goto(url);
    if (page.url().includes("/age?")) {
      await page.getByRole("button", { name: "Yes, I'm 18 or older" }).click();
      await page.waitForURL((u) => !u.pathname.startsWith("/age"));
    }
    await page.waitForLoadState("load");
    const r = await overlaps(page);
    checked += r.checked;
    for (const p of r.out) problems.push(`${url}: ${p}`);
  }
  expect(checked, "the sweep must actually look at some art").toBeGreaterThan(5);
  expect(problems).toEqual([]);
});
