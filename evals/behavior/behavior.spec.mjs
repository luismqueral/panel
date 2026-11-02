// One test per rule in panel/behavior-spec.md. Test titles start with the rule id.

import { test, expect } from "@playwright/test";
import { open, calls, fail, delay, screen, field, control, savebar, saveButton, revertButton, statusButton, confirmDialog, createDialog, emptySeed, png } from "./helpers.mjs";

const mod = process.platform === "darwin" ? "Meta" : "Control";

test.describe("save state", () => {
  test("S1 a loaded item is clean", async ({ page }) => {
    await open(page, "#/post/rail-line");
    await expect(savebar(page)).toHaveAttribute("data-state", "clean");
    await expect(saveButton(page)).toBeDisabled();
    await expect(revertButton(page)).toBeDisabled();
  });

  test("S2 edits enter dirty, undoing them returns to clean", async ({ page }) => {
    await open(page, "#/post/rail-line");
    const title = control(page, "title");
    const original = await title.inputValue();
    await title.fill(`${original}!`);
    await expect(savebar(page)).toHaveAttribute("data-state", "dirty");
    await expect(saveButton(page)).toBeEnabled();
    await title.fill(original);
    await expect(savebar(page)).toHaveAttribute("data-state", "clean");
  });

  test("S3 S4 save locks fields while saving, then stores the values", async ({ page }) => {
    await open(page, "#/post/rail-line");
    await control(page, "title").fill("A new title");
    await delay(page, 600);
    await saveButton(page).click();
    await expect(savebar(page)).toHaveAttribute("data-state", "saving");
    await expect(control(page, "title")).toBeDisabled();
    await expect(savebar(page)).toHaveAttribute("data-state", "clean");
    await expect(control(page, "title")).toBeEnabled();
    const [update] = await calls(page, "update");
    expect(update.args[2].values.title).toBe("A new title");
  });

  test("S5 a failed save keeps every edit and enables fields", async ({ page }) => {
    await open(page, "#/post/rail-line");
    await control(page, "title").fill("Kept");
    await fail(page, "update");
    await saveButton(page).click();
    await expect(savebar(page)).toHaveAttribute("data-state", "error");
    await expect(control(page, "title")).toHaveValue("Kept");
    await expect(control(page, "title")).toBeEnabled();
    await expect(saveButton(page)).toBeEnabled();
    await saveButton(page).click();
    await expect(savebar(page)).toHaveAttribute("data-state", "clean");
  });

  test("S6 revert restores the saved values", async ({ page }) => {
    await open(page, "#/post/rail-line");
    const original = await control(page, "title").inputValue();
    await control(page, "title").fill("Throwaway");
    await revertButton(page).click();
    await expect(control(page, "title")).toHaveValue(original);
    await expect(savebar(page)).toHaveAttribute("data-state", "clean");
  });

  test("S7 K1 Cmd/Ctrl+S saves and never reaches the browser", async ({ page }) => {
    await open(page, "#/post/rail-line");
    const prevented = () =>
      page.evaluate(() => !document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key: "s", metaKey: true, ctrlKey: true, bubbles: true, cancelable: true })));
    await control(page, "title").focus();
    expect(await prevented()).toBe(true);
    expect(await calls(page, "update")).toHaveLength(0);
    await control(page, "title").fill("Saved by keyboard");
    await page.keyboard.press(`${mod}+s`);
    await expect(savebar(page)).toHaveAttribute("data-state", "clean");
    expect(await calls(page, "update")).toHaveLength(1);
  });

  test("S8 leaving with unsaved changes asks the browser to confirm", async ({ page }) => {
    await open(page, "#/post/rail-line");
    const blocked = () => page.evaluate(() => !window.dispatchEvent(new Event("beforeunload", { cancelable: true })));
    expect(await blocked()).toBe(false);
    await control(page, "title").fill("Unsaved");
    expect(await blocked()).toBe(true);
  });
});

test.describe("autosave", () => {
  test("A1 A2 A3 drafts save in the background without locking fields", async ({ page }) => {
    await page.clock.install();
    await open(page, "#/post/rail-line");
    await control(page, "body").fill("Background words.");
    await delay(page, 2000);
    await page.clock.runFor(10_000);
    await expect(page.locator(".pn-savebar-message")).toHaveText("Saving…");
    await expect(savebar(page)).not.toHaveAttribute("data-state", "saving");
    await expect(control(page, "body")).toBeEnabled();
    await control(page, "title").fill("Typed during autosave");
    await page.clock.runFor(2000);
    await expect(savebar(page)).toHaveAttribute("data-state", "dirty");
    const [update] = await calls(page, "update");
    expect(update.args[2].values.body).toBe("Background words.");
  });

  test("A1 autosave skips items past their first status", async ({ page }) => {
    await page.clock.install();
    await open(page, "#/post/winter-light");
    await control(page, "body").fill("Edited, published.");
    await page.clock.runFor(21_000);
    expect(await calls(page, "update")).toHaveLength(0);
    await expect(savebar(page)).toHaveAttribute("data-state", "dirty");
  });

  test("A4 a failed background save enters error without locking", async ({ page }) => {
    await page.clock.install();
    await open(page, "#/post/rail-line");
    await control(page, "body").fill("Will fail.");
    await fail(page, "update");
    await page.clock.runFor(10_000);
    await expect(savebar(page)).toHaveAttribute("data-state", "error");
    await expect(control(page, "body")).toBeEnabled();
  });
});

test.describe("validation", () => {
  test("V1 no error while typing in a field not yet left", async ({ page }) => {
    await open(page, "#/post/rail-line");
    await control(page, "slug").fill("Not A Slug");
    await expect(control(page, "slug")).not.toHaveAttribute("aria-invalid", "true");
    await expect(field(page, "slug").locator(".pn-error")).toHaveText("");
  });

  test("V2 V5 leaving a field checks format; fixing it clears the error", async ({ page }) => {
    await open(page, "#/post/rail-line");
    await control(page, "slug").fill("Not A Slug");
    await control(page, "slug").blur();
    await expect(control(page, "slug")).toHaveAttribute("aria-invalid", "true");
    await expect(field(page, "slug").locator(".pn-error")).toHaveText("Use lowercase letters, numbers, and dashes.");
    await control(page, "slug").fill("a-slug");
    await expect(control(page, "slug")).not.toHaveAttribute("aria-invalid", "true");
    await expect(field(page, "slug").locator(".pn-error")).toHaveText("");
  });

  test("V2 leaving an empty required field is not an error", async ({ page }) => {
    await open(page, "#/post/rail-line");
    await control(page, "title").fill("");
    await control(page, "title").blur();
    await expect(control(page, "title")).not.toHaveAttribute("aria-invalid", "true");
  });

  test("V3 drafts with empty required fields still save", async ({ page }) => {
    await open(page, "#/post/small-maps");
    await control(page, "title").fill("");
    await saveButton(page).click();
    await expect(savebar(page)).toHaveAttribute("data-state", "clean");
    expect(await calls(page, "update")).toHaveLength(1);
  });

  test("V3 format errors block saving", async ({ page }) => {
    await open(page, "#/post/rail-line");
    await control(page, "slug").fill("Bad Slug");
    await saveButton(page).click();
    await expect(control(page, "slug")).toHaveAttribute("aria-invalid", "true");
    await expect(control(page, "slug")).toBeFocused();
    expect(await calls(page, "update")).toHaveLength(0);
  });

  test("V4 P3 publishing is blocked by empty required fields", async ({ page }) => {
    await open(page, "#/post/small-maps");
    await statusButton(page).click();
    await expect(confirmDialog(page)).not.toBeVisible();
    await expect(control(page, "body")).toHaveAttribute("aria-invalid", "true");
    await expect(field(page, "body").locator(".pn-error")).toHaveText("Required to publish.");
    await expect(field(page, "cover").locator(".pn-error")).toHaveText("Required to publish.");
    await expect(page.locator(".pn-savebar-message")).toHaveText("Fix 2 fields to publish");
    await expect(field(page, "cover").locator("input")).toBeFocused();
    await expect(statusButton(page)).toContainText("Draft");
    expect(await calls(page, "update")).toHaveLength(0);
  });
});

test.describe("status", () => {
  test("P1 the status button shows the current status", async ({ page }) => {
    await open(page, "#/post/rail-line");
    await expect(statusButton(page)).toContainText("Draft");
  });

  test("P4 P5 publishing confirms, then saves edits with the new status", async ({ page }) => {
    await open(page, "#/post/rail-line");
    await field(page, "cover").locator('input[type="file"]').setInputFiles(png);
    await expect(field(page, "cover")).toHaveAttribute("data-state", "filled");
    await control(page, "title").fill("Published title");
    await statusButton(page).click();
    await expect(confirmDialog(page)).toBeVisible();
    await confirmDialog(page).locator('[data-action="cancel"]').click();
    await expect(statusButton(page)).toContainText("Draft");
    expect(await calls(page, "update")).toHaveLength(0);
    await statusButton(page).click();
    await confirmDialog(page).locator('[data-action="confirm"]').click();
    await expect(statusButton(page)).toContainText("Published");
    await expect(savebar(page)).toHaveAttribute("data-state", "clean");
    const [update] = await calls(page, "update");
    expect(update.args[2].status).toBe("published");
    expect(update.args[2].values.title).toBe("Published title");
  });

  test("P2 moving back to the first status needs no confirmation", async ({ page }) => {
    await open(page, "#/post/winter-light");
    await statusButton(page).click();
    await expect(statusButton(page)).toContainText("Draft");
    await expect(confirmDialog(page)).not.toBeVisible();
  });
});

test.describe("dialogs", () => {
  test("D1 D2 D3 D5 confirm dialogs focus Cancel when negative, trap Tab, close on Escape, return focus", async ({ page }) => {
    await open(page, "#/post/rail-line");
    const del = page.locator('.pn-screen [data-action="delete"]');
    await del.click();
    const dialog = confirmDialog(page);
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('[data-action="cancel"]')).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(dialog.locator('[data-action="confirm"]')).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(dialog.locator('[data-action="cancel"]')).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(dialog.locator('[data-action="confirm"]')).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(del).toBeFocused();
    expect(await calls(page, "remove")).toHaveLength(0);
  });

  test("D4 clicking the backdrop does nothing", async ({ page }) => {
    await open(page, "#/post/rail-line");
    await page.locator('.pn-screen [data-action="delete"]').click();
    await page.mouse.click(5, 5);
    await expect(confirmDialog(page)).toBeVisible();
  });

  test("D6 only the confirm button confirms", async ({ page }) => {
    await open(page, "#/post/rail-line");
    await page.locator('.pn-screen [data-action="delete"]').click();
    await confirmDialog(page).locator('[data-action="confirm"]').click();
    await expect(page).toHaveURL(/#\/post$/);
    expect(await calls(page, "remove")).toHaveLength(1);
    await expect(page.locator(".pn-list-row")).toHaveCount(2);
  });
});

test.describe("keyboard", () => {
  test("K3 / focuses search, but types normally inside text fields", async ({ page }) => {
    await open(page, "#/post");
    await page.locator("body").press("/");
    const search = page.locator('.pn-screen input[type="search"]');
    await expect(search).toBeFocused();
    await search.pressSequentially("rail/");
    await expect(search).toHaveValue("rail/");
    await search.fill("rail");
    await expect(page.locator(".pn-list-row")).toHaveCount(1);
  });
});

test.describe("create flow", () => {
  test("C1 D1 the create dialog asks only for the title and its slug, focused on the title", async ({ page }) => {
    await open(page, "#/post");
    await page.locator('.pn-screen-actions [data-action="create"]').click();
    const dialog = createDialog(page);
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("[data-field]")).toHaveCount(2);
    await expect(dialog.locator('[data-field="title"] input')).toBeFocused();
    await expect(dialog.locator('[data-field="slug"] input')).toBeVisible();
  });

  test("C2 the slug follows the title until edited by hand", async ({ page }) => {
    await open(page, "#/post");
    await page.locator('.pn-screen-actions [data-action="create"]').click();
    const title = createDialog(page).locator('[data-field="title"] input');
    const slug = createDialog(page).locator('[data-field="slug"] input');
    await title.fill("Café Notes, Part 2");
    await expect(slug).toHaveValue("cafe-notes-part-2");
    await slug.fill("my-slug");
    await title.fill("Something else");
    await expect(slug).toHaveValue("my-slug");
  });

  test("C3 V6 creating needs the required title", async ({ page }) => {
    await open(page, "#/post");
    await page.locator('.pn-screen-actions [data-action="create"]').click();
    await createDialog(page).locator('[data-action="create"]').click();
    await expect(createDialog(page)).toBeVisible();
    await expect(createDialog(page).locator('[data-field="title"] .pn-error')).toHaveText("Required.");
    await expect(createDialog(page).locator('[data-field="title"] input')).toHaveAttribute("aria-invalid", "true");
    expect(await calls(page, "create")).toHaveLength(0);
  });

  test("C4 K4 Enter creates the item in its first status and opens it", async ({ page }) => {
    await open(page, "#/post");
    await page.locator('.pn-screen-actions [data-action="create"]').click();
    await createDialog(page).locator('[data-field="title"] input').fill("Fresh post");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#\/post\/[^/]+$/);
    await expect(screen(page)).toHaveAttribute("data-state", "ready");
    await expect(control(page, "title")).toHaveValue("Fresh post");
    await expect(control(page, "slug")).toHaveValue("fresh-post");
    await expect(statusButton(page)).toContainText("Draft");
    const [create] = await calls(page, "create");
    expect(create.args[1].status).toBe("draft");
  });

  test("C5 a failed create keeps the dialog and its values", async ({ page }) => {
    await open(page, "#/post");
    await page.locator('.pn-screen-actions [data-action="create"]').click();
    await createDialog(page).locator('[data-field="title"] input').fill("Will fail");
    await fail(page, "create");
    await createDialog(page).locator('[data-action="create"]').click();
    await expect(page.locator(".pn-toast")).toContainText("Could not create. Try again.");
    await expect(createDialog(page)).toBeVisible();
    await expect(createDialog(page).locator('[data-field="title"] input')).toHaveValue("Will fail");
  });

  test("C6 Escape cancels without creating", async ({ page }) => {
    await open(page, "#/post");
    const add = page.locator('.pn-screen-actions [data-action="create"]');
    await add.click();
    await createDialog(page).locator('[data-field="title"] input').fill("Never mind");
    await page.keyboard.press("Escape");
    await expect(createDialog(page)).not.toBeVisible();
    await expect(add).toBeFocused();
    expect(await calls(page, "create")).toHaveLength(0);
  });
});

test.describe("field controls", () => {
  test("F1 tags add on Enter and comma, ignore duplicates, and remove", async ({ page }) => {
    await open(page, "#/post/rail-line");
    const input = control(page, "tags");
    const tags = field(page, "tags").locator(".pn-tag");
    await expect(tags).toHaveCount(1);
    await input.fill("maps");
    await input.press("Enter");
    await input.pressSequentially("rivers,");
    await input.fill("maps");
    await input.press("Enter");
    await expect(tags).toHaveText(["walking", "maps", "rivers"]);
    await input.press("Backspace");
    await expect(tags).toHaveCount(2);
    await field(page, "tags").locator('[data-action="remove-tag"]').first().click();
    await expect(tags).toHaveText(["maps"]);
    await expect(input).toBeFocused();
    await saveButton(page).click();
    const [update] = await calls(page, "update");
    expect(update.args[2].values.tags).toEqual(["maps"]);
  });

  test("F2 uploads fill the field, remove empties it, failures keep the old value", async ({ page }) => {
    await open(page, "#/post/rail-line");
    const cover = field(page, "cover");
    await fail(page, "upload");
    await cover.locator('input[type="file"]').setInputFiles(png);
    await expect(cover.locator(".pn-error")).toHaveText("Could not upload. Try again.");
    await expect(cover).toHaveAttribute("data-state", "empty");
    await cover.locator('input[type="file"]').setInputFiles(png);
    await expect(cover).toHaveAttribute("data-state", "filled");
    await expect(cover.locator(".pn-file-name")).toHaveText("cover.png");
    await expect(savebar(page)).toHaveAttribute("data-state", "dirty");
    await cover.locator('[data-action="remove-file"]').click();
    await expect(cover).toHaveAttribute("data-state", "empty");
  });

  test("F3 the markdown toolbar wraps the selection", async ({ page }) => {
    await open(page, "#/post/rail-line");
    const body = control(page, "body");
    await body.fill("make this bold");
    await body.evaluate((el) => el.setSelectionRange(10, 14));
    await body.dispatchEvent("select");
    await field(page, "body").locator('[data-action="bold"]').click();
    await expect(body).toHaveValue("make this **bold**");
    await expect(savebar(page)).toHaveAttribute("data-state", "dirty");
  });

  test("F4 computed custom fields are read-only and follow their source", async ({ page }) => {
    await open(page, "#/post/rail-line");
    const time = field(page, "reading_time").locator("input");
    await expect(time).toHaveJSProperty("readOnly", true);
    await control(page, "body").fill(Array(450).fill("word").join(" "));
    await expect(time).toHaveValue("3 min");
    await saveButton(page).click();
    const [update] = await calls(page, "update");
    expect(update.args[2].values.reading_time).toBe(3);
  });
});

test.describe("screen states", () => {
  test("collections show loading, then ready", async ({ page }) => {
    await open(page, "#/");
    await delay(page, 800);
    await page.locator('.pn-nav-link[href="#/post"]').click();
    await expect(screen(page)).toHaveAttribute("data-state", "loading");
    await expect(screen(page)).toHaveAttribute("data-state", "ready");
  });

  test("collections show the empty state with a create action", async ({ page }) => {
    await open(page, "#/post", emptySeed);
    await expect(screen(page)).toHaveAttribute("data-state", "empty");
    await expect(page.locator('.pn-region-empty [data-action="create"]')).toBeVisible();
  });

  test("collections show the error state and recover", async ({ page }) => {
    await open(page, "#/");
    await fail(page, "list");
    await page.locator('.pn-nav-link[href="#/post"]').click();
    await expect(screen(page)).toHaveAttribute("data-state", "error");
    await page.locator('.pn-region-error [data-action="retry"]').click();
    await expect(screen(page)).toHaveAttribute("data-state", "ready");
  });

  test("a missing item shows an error, not a blank screen", async ({ page }) => {
    await open(page, "#/post/does-not-exist");
    await expect(screen(page)).toHaveAttribute("data-state", "error");
  });

  test("S9 navigating away with unsaved changes asks first", async ({ page }) => {
    await open(page, "#/post/rail-line");
    await control(page, "title").fill("Unsaved");
    await page.locator('.pn-nav-link[href="#/"]').click();
    await expect(confirmDialog(page)).toBeVisible();
    await confirmDialog(page).locator('[data-action="cancel"]').click();
    await expect(page).toHaveURL(/#\/post\/rail-line$/);
    await expect(control(page, "title")).toHaveValue("Unsaved");
    await page.locator('.pn-nav-link[href="#/"]').click();
    await confirmDialog(page).locator('[data-action="confirm"]').click();
    await expect(page).toHaveURL(/#\/$/);
  });

  test("singletons save like items", async ({ page }) => {
    await open(page, "#/settings");
    await control(page, "site_title").fill("Field Notes 2");
    await page.keyboard.press(`${mod}+s`);
    await expect(savebar(page)).toHaveAttribute("data-state", "clean");
    const [save] = await calls(page, "saveSingleton");
    expect(save.args[1].site_title).toBe("Field Notes 2");
  });
});
