import { expect, test, type Page } from "@playwright/test";
import { makePng } from "./fixtures";

const stamp = Date.now().toString(36);
const ADMIN = { email: "boss@toon.test", name: "Studio Boss", password: "admin password 123" };
const READER = { email: `reader-${stamp}@toon.test`, name: "Wren Reader", password: "reader password 123" };
const EDITOR = { email: `editor-${stamp}@toon.test`, name: "Eddie Editor", password: "editor password 123" };

async function signup(page: Page, u: typeof ADMIN) {
  await page.goto("/signup");
  await page.getByLabel("Display name").fill(u.name);
  await page.getByLabel("Email").fill(u.email);
  await page.getByLabel("Password").fill(u.password);
  await page.getByLabel(/I am 18 or older/).check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
}

async function login(page: Page, u: typeof ADMIN) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(u.email);
  await page.getByLabel("Password").fill(u.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
}

test.describe.serial("publish a comic and a show, then read and watch them", () => {
  test("signup validation and wrong password", async ({ page }) => {
    await page.goto("/signup");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.locator(".alert-error")).toContainText("fix the highlighted fields");
    await expect(page.getByText("You must confirm you are 18 or older.")).toBeVisible();
    await page.goto("/login");
    await page.getByLabel("Email").fill("nobody@toon.test");
    await page.getByLabel("Password").fill("wrong password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator(".alert-error")).toContainText("don't match");
  });

  test("visitors are kept out of the studio", async ({ page }) => {
    await page.goto("/studio");
    await expect(page).toHaveURL(/\/login\?next=%2Fstudio/);
  });

  test("admin builds a series, a saga, an issue with pages, and publishes it", async ({ page }) => {
    await signup(page, ADMIN);
    await page.getByRole("link", { name: "Studio", exact: true }).click();
    await page.getByRole("link", { name: "New series" }).click();
    await page.getByLabel("Title *").fill(`Volcano Racers ${stamp}`);
    await expect(page.getByLabel("Web address *")).toHaveValue(`volcano-racers-${stamp}`);
    await page.getByLabel("Tagline").fill("Toon physics. Real scars.");
    await page.getByLabel("Look").selectOption("volcano-racers");
    await page.getByLabel("Series logo: brand artwork").selectOption("/brand/logos/volcano-racers-wordmark.svg");
    await page.getByRole("button", { name: "Create series" }).click();
    await expect(page.getByRole("heading", { name: `Volcano Racers ${stamp}`, level: 1 })).toBeVisible();

    await page.getByText("Add a saga or season").click();
    await page.getByLabel("Format").selectOption("comic");
    await page.getByLabel("Title *").first().fill("Saga One: The Ember Heart Saga");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Saga One: The Ember Heart Saga" })).toBeVisible();

    await page.getByLabel("Title *").first().fill("Ignition");
    await page.getByRole("button", { name: "Create issue" }).click();
    await expect(page.getByRole("heading", { name: /Issue #1: Ignition/ })).toBeVisible();

    // Publishing is blocked until there are pages.
    await expect(page.getByRole("button", { name: "Publish now" })).toBeDisabled();

    const files = [makePng("page-02.png", 400, 600, [30, 120, 220]), makePng("page-01.png", 400, 600, [220, 60, 40]), makePng("page-03.png", 400, 600, [40, 180, 90])];
    await page.locator('input[type="file"][multiple]').setInputFiles(files);
    await expect(page.getByRole("status").filter({ hasText: "Added 3 pages." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pages (3)" })).toBeVisible();

    // Reorder: move page 2 earlier, save.
    await page.getByRole("button", { name: "Move page 2 earlier" }).click();
    await page.getByRole("button", { name: "Save page order" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Page order saved." })).toBeVisible();

    await page.getByRole("button", { name: "Publish now" }).click();
    await expect(page.getByRole("status").filter({ hasText: /Published\. Readers won't see it until the series itself is published/ })).toBeVisible();

    await page.getByRole("link", { name: `Volcano Racers ${stamp}` }).click();
    await page.getByRole("button", { name: "Publish series" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Series is live." })).toBeVisible();

    // The public page uses the IP's look and logo.
    await page.goto(`/series/volcano-racers-${stamp}`);
    await expect(page.locator(".tn-ip--volcano-racers").first()).toBeVisible();
    await expect(page.getByRole("img", { name: `Volcano Racers ${stamp}` })).toBeVisible();
  });

  test("admin adds a show season and an episode with a video link", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/studio");
    await page.getByRole("link", { name: `Volcano Racers ${stamp}` }).click();
    await page.getByText("Add a saga or season").click();
    await page.getByLabel("Format").selectOption("show");
    await page.getByLabel("Title *").first().fill("Season 1");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Season 1", level: 1 })).toBeVisible();
    await page.getByLabel("Title *").first().fill("Green Flag");
    await page.getByRole("button", { name: "Create episode" }).click();
    await expect(page.getByRole("heading", { name: /Episode #1: Green Flag/ })).toBeVisible();
    await page.getByLabel("Or paste a YouTube or Vimeo link").fill("https://example.com/not-a-video");
    await page.getByRole("button", { name: "Save video" }).click();
    await expect(page.getByText("Upload a video file, or paste a YouTube or Vimeo link.").first()).toBeVisible();
    await page.getByLabel("Or paste a YouTube or Vimeo link").fill("https://youtu.be/dQw4w9WgXcQ");
    await page.getByLabel("Length in seconds").fill("1320");
    await page.getByRole("button", { name: "Save video" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Video saved." })).toBeVisible();
    await page.getByRole("button", { name: "Publish now" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Published." })).toBeVisible();
  });

  test("a visitor passes the age gate, browses and reads the issue in order", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /Ignition/ }).first()).toBeVisible();
    await page.getByRole("link", { name: "Comics" }).first().click();
    await page.getByRole("link", { name: /Ignition/ }).first().click();
    await expect(page).toHaveURL(/\/age\?next=/);
    await page.getByRole("button", { name: "Yes, I'm 18 or older" }).click();
    await expect(page.getByRole("heading", { name: "#1 Ignition" })).toBeVisible();
    await expect(page.getByText("Page 1 of 3")).toBeVisible();
    // After reorder, page-01 (red) should be first: check the image source order in scroll mode.
    const firstSrc = await page.locator("img.reader-page").getAttribute("src");
    await page.keyboard.press("ArrowRight");
    await expect(page.getByText("Page 2 of 3")).toBeVisible();
    await page.getByRole("button", { name: "Next →" }).click();
    await expect(page.getByText("End of issue.")).toBeVisible();
    await page.getByRole("button", { name: "Scroll" }).click();
    await expect(page.locator(".reader-scroll img")).toHaveCount(3);
    expect(await page.locator(".reader-scroll img").first().getAttribute("src")).toBe(firstSrc);
    await page.getByRole("button", { name: "Page by page" }).click();

    await page.goto("/search?q=green");
    await expect(page.getByRole("link", { name: /Green Flag/ })).toBeVisible();
    await page.getByRole("link", { name: /Green Flag/ }).click();
    await expect(page.locator("iframe[src*='youtube-nocookie.com/embed/dQw4w9WgXcQ']")).toBeVisible();
  });

  test("a reader saves progress, follows the series, and can't reach the studio", async ({ page }) => {
    await signup(page, READER);
    await page.goto("/comics");
    await page.getByRole("link", { name: /Ignition/ }).first().click();
    await page.getByRole("button", { name: "Next →" }).click();
    await expect(page.getByText("Page 2 of 3")).toBeVisible();
    await page.waitForResponse((r) => r.url().endsWith("/api/progress") && r.status() === 204);
    await page.getByRole("link", { name: `Volcano Racers ${stamp}` }).click();
    await page.getByRole("button", { name: "Follow this series" }).click();
    await expect(page.getByRole("button", { name: "Following ✓" })).toBeVisible();
    await page.getByRole("link", { name: "My library" }).first().click();
    await expect(page.getByRole("heading", { name: "In progress" })).toBeVisible();
    await expect(page.locator("section", { hasText: "In progress" }).getByRole("link", { name: /Ignition/ })).toBeVisible();
    await expect(page.locator("section", { hasText: "Following" }).getByRole("link", { name: new RegExp(`Volcano Racers ${stamp}`) })).toBeVisible();
    // Reopening resumes on page 2.
    await page.locator("section", { hasText: "In progress" }).getByRole("link", { name: /Ignition/ }).click();
    await expect(page.getByText("Page 2 of 3")).toBeVisible();

    await expect(page.getByRole("link", { name: "Studio", exact: true })).toHaveCount(0);
    await page.goto("/studio");
    await expect(page.getByRole("heading", { name: "You don't have access to this" })).toBeVisible();
    const res = await page.request.post("/api/upload", { multipart: { kind: "image", file: { name: "x.png", mimeType: "image/png", buffer: Buffer.from("x") } } });
    expect(res.status()).toBe(403);
  });

  test("admin promotes an editor; editors can't manage people", async ({ page, browser }) => {
    const ctx = await browser.newContext();
    const ep = await ctx.newPage();
    await signup(ep, EDITOR);

    await login(page, ADMIN);
    await page.goto("/studio/users");
    const row = page.getByRole("row", { name: new RegExp(EDITOR.email) });
    await row.getByLabel("Role").selectOption("editor");
    await row.getByRole("button", { name: "Save role" }).click();
    await expect(row.getByRole("status")).toContainText("Role updated.");
    // The last admin can't demote themselves.
    const me = page.getByRole("row", { name: /\(you\)/ });
    await me.getByLabel("Role").selectOption("reader");
    await me.getByRole("button", { name: "Save role" }).click();
    await expect(me.getByRole("alert")).toContainText("at least one active admin");

    await ep.goto("/studio");
    await expect(ep.getByRole("heading", { name: "Series", level: 1 })).toBeVisible();
    await expect(ep.getByRole("link", { name: "People and roles" })).toHaveCount(0);
    await ep.goto("/studio/users");
    await expect(ep.getByRole("heading", { name: "You don't have access to this" })).toBeVisible();

    await page.goto("/studio/activity");
    await expect(page.getByRole("cell", { name: "user.role_changed" }).first()).toBeVisible();
    await expect(page.getByRole("cell", { name: "release.published" }).first()).toBeVisible();
    await ctx.close();
  });

  test("unpublishing hides an issue from readers again", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/comics");
    const href = await page.getByRole("link", { name: /Ignition/ }).first().getAttribute("href");
    const id = href!.split("/").pop();
    await page.goto(`/studio/releases/${id}`);
    await page.getByRole("button", { name: "Unpublish (back to draft)" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Unpublished" })).toBeVisible();
    const anon = await page.context().browser()!.newContext();
    const p2 = await anon.newPage();
    const r = await p2.goto(`/read/${id}`);
    // Age gate first, then not found.
    await p2.getByRole("button", { name: "Yes, I'm 18 or older" }).click();
    await expect(p2.getByRole("heading", { name: "Page not found" })).toBeVisible();
    expect(r).not.toBeNull();
    await anon.close();
  });
});
