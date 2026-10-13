import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { chromium } from "@playwright/test";

const root = resolve("dist");
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};
const browser = await chromium.launch({
  executablePath: process.env.ARES_CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});

try {
  for (const mount of ["/", "/Ares/"]) {
    // No fallback at the domain root: wrong absolute URLs must actually fail.
    const server = createServer(async (request, response) => {
      const path = new URL(request.url, "http://localhost").pathname;
      if (!path.startsWith(mount)) {
        response.writeHead(404).end("Outside the site mount");
        return;
      }
      const file = resolve(root, path.slice(mount.length) || "index.html");
      if (!file.startsWith(root + sep)) {
        response.writeHead(403).end();
        return;
      }
      try {
        const body = await readFile(file);
        response.writeHead(200, {
          "Content-Type": mime[extname(file)] || "application/octet-stream",
        });
        response.end(body);
      } catch {
        response.writeHead(404).end("Missing build asset");
      }
    });
    await new Promise((ready) => server.listen(0, "127.0.0.1", ready));
    try {
      for (const width of [1440, 390]) {
        const page = await browser.newPage({
          viewport: { width, height: 900 },
        });
        try {
          const failures = [];
          page.on("pageerror", (error) => failures.push(error.message));
          page.on("response", (response) => {
            if (response.status() >= 400) failures.push(response.url());
          });
          page.on("requestfailed", (request) => {
            failures.push(`${request.url()}: ${request.failure()?.errorText}`);
          });
          const url = `http://127.0.0.1:${server.address().port}${mount}`;
          await page.goto(url, { waitUntil: "networkidle" });
          await page.evaluate(() => document.fonts.ready);
          const images = page.locator("[data-film-image]");
          assert.equal(await images.count(), 3);
          for (const image of await images.all()) {
            await image.scrollIntoViewIfNeeded();
            await image.evaluate((element) => element.decode());
          }
          const loaded = await images.evaluateAll((elements) =>
            elements.every(
              (element) => element.complete && element.naturalWidth > 0,
            ),
          );
          assert.ok(loaded, "All film images must load");
          const hero = await page
            .locator("#home img")
            .evaluate((element) => new URL(element.currentSrc).pathname);
          assert.equal(
            hero,
            `${mount}images/ares-hero${width < 761 ? "-mobile" : ""}.webp`,
          );
          await page.locator('[data-concept="botanical"]').click();
          assert.equal(
            await page.locator("#concept-panel").getAttribute("data-theme"),
            "botanical",
          );
          assert.ok(
            await page.evaluate(
              () =>
                document.fonts.check('400 16px "DM Sans"') &&
                document.fonts.check('400 24px "Cormorant Garamond"'),
            ),
          );
          assert.deepEqual(failures, [], "No build assets may fail to load");
          console.log(
            `PASS ${mount} at ${width}px: images, fonts, CSS, and JavaScript`,
          );
        } finally {
          await page.close();
        }
      }
    } finally {
      await new Promise((closed) => server.close(closed));
    }
  }
} finally {
  await browser.close();
}
