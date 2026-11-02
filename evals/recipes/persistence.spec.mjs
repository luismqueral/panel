// Verification for google-login, json-files, local-disk, and none (recipes/*.md, Verify).
// Google itself is replaced by a stub sign-in button and a fake token verifier (D-015).

import { test, expect } from "@playwright/test";
import { mkdtemp, readFile, readdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createPanelServer } from "../../panel/recipes/server/server.mjs";
import { createSessions } from "../../panel/recipes/server/session.mjs";
import { createJsonFiles } from "../../panel/recipes/server/json-files.mjs";
import { createLocalDisk } from "../../panel/recipes/server/local-disk.mjs";
import { fail } from "../../panel/recipes/server/errors.mjs";

const dist = fileURLToPath(new URL("../fixtures/vanilla-blog/dist/", import.meta.url));
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const TOKENS = { "token-me": { email: "me@example.com" }, "token-other": { email: "other@example.com" } };

async function start({ recipe = "google-login", allow = ["me@example.com"], secret = "s".repeat(40), dir } = {}) {
  dir ??= await mkdtemp(join(tmpdir(), "panel-recipes-"));
  const { PANEL } = await import(pathToFileURL(join(dist, "panel.config.js")));
  const auth =
    recipe === "none"
      ? { recipe }
      : { recipe, allow, clientId: "test-client", sessions: createSessions(secret), verify: async (c) => TOKENS[c] ?? Promise.reject(fail("unauthorized", "bad token")) };
  const server = createPanelServer({
    root: dist,
    config: PANEL,
    data: createJsonFiles({ dir: join(dir, "content"), config: PANEL }),
    files: createLocalDisk({ dir: join(dir, "uploads"), url: "/uploads" }),
    auth,
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, dir, close: () => new Promise((r) => server.close(r)) };
}

// Stands in for Google's script: renders a button that hands the page a credential.
async function stubGoogle(page, credential = "token-me") {
  await page.route("https://accounts.google.com/gsi/client", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `window.google = { accounts: { id: {
        initialize(o) { this.cb = o.callback; },
        renderButton(el) { const b = document.createElement("button"); b.className = "pn-button"; b.type = "button"; b.textContent = "Sign in with Google"; b.onclick = () => this.cb({ credential: ${JSON.stringify(credential)} }); el.append(b); },
        disableAutoSelect() {},
      } } };`,
    }),
  );
}

const signIn = (page, url, credential = "token-me") => page.request.post(`${url}/api/session`, { data: { credential }, headers: { "x-panel": "1" } });
const screenReady = (page) => expect(page.locator(".pn-screen")).toHaveAttribute("data-state", /ready|empty/);

let server;
test.afterEach(async () => server?.close());

test.describe("project server", () => {
  test("serves only the panel's page, scripts, styles, and data files", async ({ page }) => {
    server = await start();
    expect((await page.request.get(`${server.url}/panel.config.js`)).status()).toBe(200);
    expect(await (await page.request.get(`${server.url}/panel.config.js`)).text()).not.toContain("me@example.com");
    expect((await page.request.get(`${server.url}/server/server.mjs`)).status()).toBe(404);
    expect((await page.request.get(`${server.url}/CONFORMANCE.md`)).status()).toBe(404);
  });
});

test.describe("google-login", () => {
  test("signed out: the API refuses and the page shows login", async ({ page }) => {
    server = await start();
    const res = await page.request.get(`${server.url}/api/items/post`);
    expect(res.status()).toBe(401);
    expect((await res.json()).error.code).toBe("unauthorized");
    await stubGoogle(page);
    await page.goto(`${server.url}/#/post`);
    await expect(page.locator('[data-template="screen-login"]')).toBeVisible();
  });

  test("signing in with an allowed account opens the panel", async ({ page }) => {
    server = await start();
    await stubGoogle(page, "token-me");
    await page.goto(`${server.url}/`);
    await page.getByRole("button", { name: "Sign in with Google" }).click();
    await screenReady(page);
    await expect(page.locator(".pn-nav-user")).toHaveText("me@example.com");
    const cookies = await page.context().cookies();
    const session = cookies.find((c) => c.name === "pn_session");
    expect(session.httpOnly).toBe(true);
    expect(session.sameSite).toBe("Lax");
  });

  test("an account not on the allow list is refused with a message", async ({ page }) => {
    server = await start();
    await stubGoogle(page, "token-other");
    await page.goto(`${server.url}/`);
    await page.getByRole("button", { name: "Sign in with Google" }).click();
    await expect(page.locator(".pn-login .pn-error")).toHaveText("This account isn't allowed. Sign in with another one.");
    expect((await page.context().cookies()).some((c) => c.name === "pn_session")).toBe(false);
    expect((await signIn(page, server.url, "token-other")).status()).toBe(403);
    expect((await signIn(page, server.url, "forged")).status()).toBe(401);
  });

  test("changes without the x-panel header are refused", async ({ page }) => {
    server = await start();
    await signIn(page, server.url);
    const res = await page.request.post(`${server.url}/api/items/post`, { data: { status: "draft", values: { title: "x" } } });
    expect(res.status()).toBe(403);
  });

  test("a forged cookie is refused, and removing an address revokes its session", async ({ page }) => {
    server = await start();
    await signIn(page, server.url);
    const { dir } = server;
    const cookie = (await page.context().cookies()).find((c) => c.name === "pn_session");
    const [body, mac] = cookie.value.split(".");
    const forged = Buffer.from(JSON.stringify({ u: "boss@example.com", exp: 9e9 })).toString("base64url");
    const res = await page.request.get(`${server.url}/api/items/post`, { headers: { cookie: `pn_session=${forged}.${mac}` } });
    expect(res.status()).toBe(401);
    expect(body).toBeTruthy();
    await server.close();
    server = await start({ dir, allow: ["someone@example.com"] });
    const after = await page.request.get(`${server.url}/api/items/post`, { headers: { cookie: `pn_session=${cookie.value}` } });
    expect(after.status()).toBe(403);
  });

  test("logging out clears the session", async ({ page }) => {
    server = await start();
    await stubGoogle(page);
    await signIn(page, server.url);
    await page.goto(`${server.url}/`);
    await screenReady(page);
    await page.locator('[data-action="logout"]').click();
    await expect(page.locator('[data-template="screen-login"]')).toBeVisible();
    expect((await page.request.get(`${server.url}/api/session`)).status()).toBe(401);
  });

  test("a session that ends mid-use shows login on the next screen", async ({ page }) => {
    server = await start();
    await stubGoogle(page);
    await signIn(page, server.url);
    await page.goto(`${server.url}/#/post`);
    await screenReady(page);
    await page.context().clearCookies();
    await page.locator('.pn-nav-link[href="#/settings"]').click();
    await expect(page.locator('[data-template="screen-login"]')).toBeVisible();
  });
});

test.describe("json-files and local-disk", () => {
  test("create, edit, upload, publish, reload: everything persists on disk", async ({ page }) => {
    server = await start();
    await signIn(page, server.url);
    await page.goto(`${server.url}/#/post`);
    await expect(page.locator(".pn-screen")).toHaveAttribute("data-state", "empty");
    await page.locator('.pn-screen-actions [data-action="create"]').click();
    await page.locator('dialog[data-template="screen-create"] [data-field="title"] input').fill("Persisted post");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#\/post\/[a-f0-9]+$/);
    const id = page.url().split("/").pop();

    await page.locator('[data-field="date"] input').fill("2026-10-30");
    await page.locator('[data-field="body"] textarea').fill("Words that should survive a reload.");
    await page.locator('[data-field="tags"] input').fill("kept");
    await page.locator('[data-field="tags"] input').press("Enter");
    await page.locator('[data-field="cover"] input[type="file"]').setInputFiles({ name: "My Cover!.png", mimeType: "image/png", buffer: PNG });
    await expect(page.locator('[data-field="cover"]')).toHaveAttribute("data-state", "filled");
    await page.locator('[data-action="status"]').click();
    await page.locator('dialog[data-template="screen-dialog"] [data-action="confirm"]').click();
    await expect(page.locator('[data-action="status"]')).toContainText("Published");
    await expect(page.locator(".pn-savebar")).toHaveAttribute("data-state", "clean");

    await page.reload();
    await screenReady(page);
    await expect(page.locator('[data-field="title"] input')).toHaveValue("Persisted post");
    await expect(page.locator('[data-field="body"] textarea')).toHaveValue("Words that should survive a reload.");
    await expect(page.locator('[data-field="tags"] .pn-tag')).toHaveText(["kept"]);
    await expect(page.locator('[data-action="status"]')).toContainText("Published");
    await expect(page.locator('[data-field="cover"] .pn-file-name')).toHaveText("My Cover!.png");

    const stored = JSON.parse(await readFile(join(server.dir, "content", "post", `${id}.json`), "utf8"));
    expect(stored).toMatchObject({ id, type: "post", status: "published", values: { title: "Persisted post", slug: "persisted-post", tags: ["kept"] } });
    expect(stored.values.cover.url).toMatch(/^\/uploads\/\d{4}\/\d{2}\/[a-f0-9]{8}-My-Cover-.png$/);
    const file = join(server.dir, stored.values.cover.url.replace(/^\/uploads/, "uploads"));
    expect((await stat(file)).size).toBe(PNG.length);
    const served = await page.request.get(`${server.url}${stored.values.cover.url}`);
    expect(served.headers()["content-type"]).toBe("image/png");
    expect(served.headers()["x-content-type-options"]).toBe("nosniff");
    expect(served.headers()["content-security-policy"]).toContain("sandbox");
    await expect(page.locator('[data-field="cover"] img')).toHaveJSProperty("naturalWidth", 1);
  });

  test("singletons persist", async ({ page }) => {
    server = await start();
    await signIn(page, server.url);
    await page.goto(`${server.url}/#/settings`);
    await screenReady(page);
    await page.locator('[data-field="site_title"] input').fill("Field Notes, saved");
    await page.locator('.pn-savebar [data-action="save"]').click();
    await expect(page.locator(".pn-savebar")).toHaveAttribute("data-state", "clean");
    await page.reload();
    await screenReady(page);
    await expect(page.locator('[data-field="site_title"] input')).toHaveValue("Field Notes, saved");
    expect(JSON.parse(await readFile(join(server.dir, "content", "settings.json"), "utf8")).values.site_title).toBe("Field Notes, saved");
  });

  test("deleting an item removes its file", async ({ page }) => {
    server = await start();
    await signIn(page, server.url);
    const created = await (await page.request.post(`${server.url}/api/items/post`, { data: { status: "draft", values: { title: "Doomed" } }, headers: { "x-panel": "1" } })).json();
    await page.goto(`${server.url}/#/post/${created.id}`);
    await screenReady(page);
    await page.locator('.pn-screen [data-action="delete"]').click();
    await page.locator('dialog[data-template="screen-dialog"] [data-action="confirm"]').click();
    await expect(page).toHaveURL(/#\/post$/);
    expect(await readdir(join(server.dir, "content", "post"))).toEqual([]);
  });

  test("the server refuses anything the schema does not declare", async ({ page }) => {
    server = await start();
    await signIn(page, server.url);
    const h = { "x-panel": "1" };
    const post = (path, data) => page.request.post(`${server.url}${path}`, { data, headers: h });
    expect((await post("/api/items/page", { values: {} })).status()).toBe(400);
    expect((await post("/api/items/post", { status: "draft", values: { evil: 1 } })).status()).toBe(400);
    expect((await post("/api/items/post", { status: "archived", values: {} })).status()).toBe(400);
    expect((await page.request.get(`${server.url}/api/items/post/..%2F..%2Fetc`)).status()).toBe(404);
    expect((await page.request.get(`${server.url}/api/items/post/${encodeURIComponent("../settings")}`)).status()).toBe(404);
    expect((await page.request.get(`${server.url}/uploads/..%2F..%2Fpackage.json`)).status()).toBe(404);
    const html = await page.request.post(`${server.url}/api/files`, { data: Buffer.from("<script>alert(1)</script>"), headers: { ...h, "content-type": "text/html", "x-file-name": "x.html" } });
    expect(html.status()).toBe(400);
    const big = await page.request.post(`${server.url}/api/files`, { data: Buffer.alloc(10 * 1024 * 1024 + 1), headers: { ...h, "content-type": "image/png", "x-file-name": "big.png" } });
    expect(big.status()).toBe(413);
  });
});

test.describe("none", () => {
  test("with no login, the panel opens and saves directly", async ({ page }) => {
    server = await start({ recipe: "none" });
    await page.goto(`${server.url}/#/settings`);
    await screenReady(page);
    expect(await (await page.request.get(`${server.url}/api/session`)).json()).toEqual({ user: "local" });
    await page.locator('[data-field="site_title"] input').fill("Local only");
    await page.keyboard.press(process.platform === "darwin" ? "Meta+s" : "Control+s");
    await expect(page.locator(".pn-savebar")).toHaveAttribute("data-state", "clean");
    expect(JSON.parse(await readFile(join(server.dir, "content", "settings.json"), "utf8")).values.site_title).toBe("Local only");
  });
});
