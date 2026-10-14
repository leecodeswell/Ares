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
  ".png": "image/png",
  ".webm": "video/webm",
  ".mp4": "video/mp4",
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
          const images = page.locator("[data-film-image], [data-journey-still]");
          assert.equal(await images.count(), 2);
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
          const intro = await page.evaluate(async () => {
            const video = document.querySelector("[data-intro] video");
            const poster = document.querySelector("[data-intro] img");
            await poster.decode();
            await new Promise((ready) => {
              if (video.readyState >= 2) ready();
              else video.addEventListener("loadeddata", ready, { once: true });
            });
            return {
              poster: new URL(poster.currentSrc).pathname,
              video: new URL(video.currentSrc).pathname,
            };
          });
          assert.equal(intro.poster, `${mount}intro/poster.webp`);
          assert.match(intro.video, new RegExp(`^${mount}intro/garden-loop\\.(webm|mp4)$`));
          const introEnd = await page.evaluate(() => {
            const element = document.querySelector("[data-intro]");
            return element.offsetTop + element.offsetHeight;
          });
          await page.evaluate((end) => scrollTo({ top: (end - innerHeight) * 0.3, behavior: "instant" }), introEnd);
          await page.waitForFunction(() => {
            const canvas = document.querySelector("[data-intro-light]");
            const pixels = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
            // The light is drawn live: look for warm gold ray pixels.
            for (let i = 0; i < pixels.length; i += 4) {
              if (pixels[i] > 190 && pixels[i + 1] > 140 && pixels[i + 2] < 235 && pixels[i + 3] > 120) return true;
            }
            return false;
          });
          // the statue's turn: this screen's frames load (tiny ones are inlined)
          const variant = width < 761 ? "mobile" : "desktop";
          await page.waitForFunction(
            (variant) =>
              performance
                .getEntriesByType("resource")
                .filter((entry) => new RegExp(`/${variant}-\\d\\d-[^/]*\\.webp$`).test(entry.name)).length >= 20,
            variant,
          );
          await page.locator("[data-journey]").scrollIntoViewIfNeeded();
          await page.waitForFunction(() =>
            ["sky", "marble"].every((name) =>
              performance.getEntriesByType("resource").some((entry) => new RegExp(`/${name}[^/]*\\.webp$`).test(entry.name)),
            ),
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
            `PASS ${mount} at ${width}px: intro media, journey textures, images, fonts, CSS, and JavaScript`,
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
