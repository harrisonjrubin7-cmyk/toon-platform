import { expect, test, type Page } from "@playwright/test";
import pg from "pg";
import { makePng } from "./fixtures";

const stamp = Date.now().toString(36);
const CREATOR = { email: `creator-${stamp}@toon.test`, name: "Cass Creator", password: "creator password 123", handle: `cass_${stamp}`.slice(0, 30) };
const FAN = { email: `fan-${stamp}@toon.test`, name: "Finn Fan", password: "fan password 123", handle: `finn_${stamp}`.slice(0, 30) };
const MOD = { email: `mod-${stamp}@toon.test`, name: "Mo Moderator", password: "mod password 123", handle: "" };
const DB = process.env.E2E_DATABASE_URL ?? "postgres://postgres@localhost:5433/toon_e2e";

async function signup(page: Page, u: typeof CREATOR) {
  await page.goto("/signup");
  await page.getByLabel("Display name").fill(u.name);
  await page.getByLabel("Email").fill(u.email);
  await page.getByLabel("Password").fill(u.password);
  await page.getByLabel(/I am 18 or older/).check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
}

async function login(page: Page, u: typeof CREATOR) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(u.email);
  await page.getByLabel("Password").fill(u.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
}

async function makeProfile(page: Page, handle: string) {
  await page.getByLabel("Handle *").fill(handle);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create profile" }).click();
}

/** Nothing is drawn on top of the art: every sample point on the image hits the image itself. */
async function expectNothingOver(page: Page, selector: string) {
  const el = page.locator(selector);
  await expect(el).toBeVisible();
  const covered = await el.evaluate((img) => {
    const r = img.getBoundingClientRect();
    const hits: string[] = [];
    for (const fx of [0.05, 0.5, 0.95]) for (const fy of [0.05, 0.5, 0.95]) {
      const x = r.left + r.width * fx, y = Math.max(0, r.top) + (Math.min(r.bottom, innerHeight) - Math.max(0, r.top)) * fy;
      const top = document.elementFromPoint(x, y);
      if (top && top !== img) hits.push(`${top.tagName}.${top.className}`);
    }
    return hits;
  });
  expect(covered).toEqual([]);
}

let comicUrl = "";

test.describe.serial("community: make, share, react, report and moderate a fan comic", () => {
  test("visitors are asked to sign in before creating", async ({ page }) => {
    await page.goto("/create");
    await expect(page).toHaveURL(/\/login\?next=%2Fcreate/);
  });

  test("a creator sets up a profile, builds a comic from a layout, letters it and publishes", async ({ page }) => {
    await signup(page, CREATOR);
    await page.getByRole("link", { name: "Create", exact: true }).click();
    await expect(page).toHaveURL(/\/create\/profile/);
    // Terms are required.
    await page.getByLabel("Handle *").fill(CREATOR.handle);
    await page.getByRole("button", { name: "Create profile" }).click();
    await expect(page.getByText("Accept the community guidelines and creator terms to continue.")).toBeVisible();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Create profile" }).click();
    await expect(page.getByRole("heading", { name: "My creations" })).toBeVisible();

    await page.getByLabel("Title *").fill("Pit Lane Blues");
    await page.getByRole("button", { name: "Start comic" }).click();
    await expect(page.getByRole("heading", { name: "Pit Lane Blues", level: 1 })).toBeVisible();
    await expect(page.getByText("Page 1, panel 1 needs art.")).toBeVisible();

    await page.getByLabel("Layout for page 1").selectOption("two-across");
    await page.getByLabel("Art for page 1, panel 1").setInputFiles(makePng("fan-1.png", 300, 200, [200, 60, 30]));
    await expect(page.locator(".editor-panel img").first()).toBeVisible();
    await page.getByLabel("Art for page 1, panel 2").setInputFiles(makePng("fan-2.png", 300, 200, [30, 60, 200]));
    await expect(page.locator(".editor-panel img")).toHaveCount(2);
    await page.getByRole("button", { name: "Add lettering to page 1, panel 1" }).click();
    await page.getByLabel("Line 1 speaker, page 1, panel 1").fill("Wren");
    await page.getByLabel("Line 1 text, page 1, panel 1").fill("Hold on to something!");
    await page.getByRole("button", { name: "Add lettering to page 1, panel 2" }).click();
    await page.getByLabel("Line 1 type, page 1, panel 2").selectOption("sfx");
    await page.getByLabel("Line 1 text, page 1, panel 2").fill("VRRRM");
    await page.getByLabel("Describe page 1, panel 1 for screen readers").fill("Wren grips the wheel of car #19");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();

    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Published. It's live" })).toBeVisible();
    await page.getByRole("link", { name: "View live comic" }).click();
    await expect(page).toHaveURL(/\/c\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { name: "Pit Lane Blues", level: 1 })).toBeVisible();
    comicUrl = new URL(page.url()).pathname;

    // Lettering sits in its own strip under the panel, and nothing covers the art.
    const art = page.getByRole("img", { name: "Wren grips the wheel of car #19" });
    await expectNothingOver(page, ".fan-panel__art >> nth=0");
    await expectNothingOver(page, ".fan-panel__art >> nth=1");
    const strip = page.locator(".letter-strip").first();
    await expect(strip).toContainText("Hold on to something!");
    const a = (await art.boundingBox())!, s = (await strip.boundingBox())!;
    expect(s.y).toBeGreaterThanOrEqual(a.y + a.height - 1);
    await expect(page.locator(".letter-strip").nth(1)).toContainText("VRRRM");
  });

  test("a fan finds it in the community, likes, comments, follows, pitches an idea and reports", async ({ page }) => {
    await signup(page, FAN);
    await page.getByRole("link", { name: "Community", exact: true }).click();
    await page.getByRole("link", { name: /Pit Lane Blues/ }).click();
    await page.getByRole("button", { name: "♥ Like (0)" }).click();
    await expect(page.getByRole("button", { name: "♥ Liked (1)" })).toBeVisible();
    await page.getByRole("button", { name: "Follow" }).click();
    await expect(page.getByRole("button", { name: "Following ✓" })).toBeVisible();

    // Commenting needs a profile.
    await page.getByLabel("Add a comment *").fill("That pit stop!");
    await page.getByRole("button", { name: "Post comment" }).click();
    await expect(page.getByText("Set up your creator profile first.")).toBeVisible();
    await page.goto(`/create/profile?next=${encodeURIComponent(comicUrl)}`);
    await makeProfile(page, FAN.handle);
    await expect(page).toHaveURL(new RegExp(`${comicUrl}$`));
    await page.getByLabel("Add a comment *").fill("That pit stop!");
    await page.getByRole("button", { name: "Post comment" }).click();
    await expect(page.locator(".comment").filter({ hasText: "That pit stop!" })).toBeVisible();

    await page.getByRole("button", { name: "Report", exact: true }).first().click();
    await page.getByLabel("Copies someone else's work").check();
    await page.getByRole("button", { name: "Send report" }).click();
    await expect(page.getByRole("status").filter({ hasText: "The studio will review your report." })).toBeVisible();

    await page.goto("/ideas/new");
    await page.getByLabel("Title *").fill("Ember before the theft");
    await page.getByLabel("Your idea *").fill("A one-shot about Ember's last clean race, before everything went wrong.");
    await page.getByRole("button", { name: "Post idea" }).click();
    await expect(page.getByRole("heading", { name: "Ember before the theft" })).toBeVisible();
    await page.goto("/community?tab=following");
    await expect(page.getByRole("link", { name: /Pit Lane Blues/ })).toBeVisible();
  });

  test("the creator is notified", async ({ page }) => {
    await login(page, CREATOR);
    await page.getByRole("link", { name: /Notifications \(3\)/ }).click();
    await expect(page.getByText(`@${FAN.handle} liked your comic.`)).toBeVisible();
    await expect(page.getByText(`@${FAN.handle} started following you.`)).toBeVisible();
    await expect(page.getByText(/commented on your comic: “That pit stop!”/)).toBeVisible();
    await page.getByRole("button", { name: "Mark all as read" }).click();
    await expect(page.getByRole("link", { name: /Notifications \(/ })).toHaveCount(0);
  });

  test("readers can't open the studio queue; an editor hides the reported comic", async ({ page, browser }) => {
    await signup(page, MOD);
    await page.goto("/studio/community");
    await expect(page).toHaveURL(/\/forbidden/);
    const c = new pg.Client({ connectionString: DB });
    await c.connect();
    await c.query("update users set role = 'editor' where email = $1", [MOD.email]);
    await c.end();
    await page.goto("/studio/community");
    const item = page.locator("li.card").filter({ hasText: "Pit Lane Blues" });
    await expect(item).toContainText("Copies someone else's work");
    await item.getByPlaceholder("Note to the author").fill("Checking the art source.");
    await item.getByRole("button", { name: "Hide" }).click();
    // The report is closed and the comic moves to the hidden list.
    await expect(item).toHaveCount(0);
    await expect(page.locator("section", { hasText: "Hidden and removed" }).locator("li", { hasText: "Pit Lane Blues" })).toBeVisible();

    const visitor = await browser.newPage();
    await visitor.goto(comicUrl);
    await visitor.getByRole("button", { name: /18 or older/ }).click();
    await expect(visitor.getByText(/not found|could not be found|doesn.t exist/i).first()).toBeVisible();
    await visitor.goto("/community");
    await expect(visitor.getByRole("link", { name: /Pit Lane Blues/ })).toHaveCount(0);
    await visitor.close();

    await page.goto("/studio/community");
    const hidden = page.locator("section", { hasText: "Hidden and removed" }).locator("li", { hasText: "Pit Lane Blues" });
    await hidden.getByRole("button", { name: "Restore" }).click();
    await expect(hidden).toHaveCount(0);
    await page.goto(comicUrl);
    await expect(page.getByRole("heading", { name: "Pit Lane Blues", level: 1 })).toBeVisible();
  });
});
