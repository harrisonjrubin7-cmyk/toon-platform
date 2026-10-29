import { expect, test } from "@playwright/test";

const stamp = Date.now().toString(36);
const PLAYER = { email: `racer-${stamp}@toon.test`, name: "Pit Crew", password: "racer password 123" };

test.describe("card game", () => {
  test("starter deck, test-mode pack purchase, ripping, collection, deck rules and a race", async ({ page }) => {
    // Visitors see the pitch and the public odds.
    await page.goto("/play");
    await expect(page.getByRole("link", { name: "Create a free account" })).toBeVisible();
    await page.goto("/play/packs/odds/ember-heart-booster");
    await expect(page.getByRole("heading", { name: /odds/ })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Blaze", exact: true })).toBeVisible();

    await page.goto("/signup?next=/play");
    await page.getByLabel("Display name").fill(PLAYER.name);
    await page.getByLabel("Email").fill(PLAYER.email);
    await page.getByLabel("Password").fill(PLAYER.password);
    await page.getByLabel(/I am 18 or older/).check();
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("heading", { name: /Welcome to the garage/ })).toBeVisible();
    await expect(page.getByText("copies owned")).toBeVisible();

    // Buy 3 packs in test mode, then rip one.
    await page.goto("/play/packs");
    await page.getByLabel("Packs", { exact: true }).selectOption("3");
    await page.getByRole("button", { name: /Get 3/ }).click();
    await expect(page.getByText("Payment received")).toBeVisible();
    await expect(page.getByRole("link", { name: "Rip it" })).toHaveCount(3);
    await page.getByRole("link", { name: "Rip it" }).first().click();
    await page.getByRole("button", { name: /Tap to rip/ }).click();
    await page.getByRole("button", { name: "Show all" }).click();
    await expect(page.getByRole("heading", { name: "You pulled" })).toBeVisible();
    await expect(page.locator(".pull-strip figure")).toHaveCount(5);

    // Opening an already opened pack shows the same cards instead of new ones.
    const url = page.url();
    await page.goto(url);
    await expect(page.getByRole("heading", { name: "Already ripped" })).toBeVisible();
    await page.goto("/play/packs");
    await expect(page.getByRole("link", { name: "Rip it" })).toHaveCount(2);

    await page.goto("/play/collection");
    await expect(page.getByText(/collector points/).first()).toBeVisible();

    // A deck can't be saved with cards you don't own (server check), and incomplete decks aren't race-ready.
    await page.goto("/play/decks/new");
    await page.getByRole("button", { name: "Add Flicker" }).click();
    await page.getByRole("button", { name: "Save deck" }).click();
    await expect(page.getByText(/needs a few changes/)).toBeVisible();
    await expect(page.getByText(/exactly 20 cards/).first()).toBeVisible();

    // Race the computer with the starter deck and concede.
    await page.goto("/play/battle");
    await page.getByRole("button", { name: "Start the race" }).click();
    await expect(page.getByRole("button", { name: "End turn" })).toBeVisible();
    await page.getByRole("button", { name: "Concede" }).click();
    await expect(page.getByText(/wins\./)).toBeVisible();
    await page.goto("/play");
    await expect(page.getByText("0–1")).toBeVisible();
  });

  test("store admin is for admins only", async ({ page }) => {
    await page.goto("/studio/cards");
    await expect(page).toHaveURL(/login/);
  });
});
