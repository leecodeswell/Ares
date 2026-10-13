import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const url = process.env.ARES_TEST_URL || 'http://127.0.0.1:5173';
const screenshotDir = process.env.ARES_SCREENSHOT_DIR || '/tmp/ares-shots';
await mkdir(screenshotDir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.ARES_CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
const report = { url, checks: [], consoleErrors: [], pageErrors: [], requestsFailed: [], canceledImageRequests: [], screenshots: [] };
const check = (name, passed, detail = null) => report.checks.push({ name, passed, detail });
function watchErrors(target) {
  target.on('pageerror', error => report.pageErrors.push(error.message));
  target.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
  target.on('requestfailed', request => {
    const failure = { url: request.url(), error: request.failure()?.errorText };
    // Responsive picture swaps can cancel the previous source during a resize.
    // Actual completeness is checked on every desktop and mobile image below.
    if (request.resourceType() === 'image' && failure.error === 'net::ERR_ABORTED') report.canceledImageRequests.push(failure);
    else report.requestsFailed.push(failure);
  });
}
async function captureScene(target, selector, name) {
  await target.locator(selector).evaluate(element => element.scrollIntoView({ block: 'start', behavior: 'instant' }));
  await target.waitForTimeout(1100);
  const path = `${screenshotDir}/${name}.png`;
  await target.screenshot({ path });
  report.screenshots.push(path);
}
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
const page = await context.newPage();
watchErrors(page);
await page.goto(url, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(1000);
const pageInfo = await page.evaluate(() => ({ title: document.title, heading: document.querySelector('h1')?.textContent, bodyText: document.body.innerText, width: document.documentElement.scrollWidth, viewport: innerWidth }));
check('Page has a title and heading', !!pageInfo.title && !!pageInfo.heading, { title: pageInfo.title, heading: pageInfo.heading });
check('No excluded business branding is visible', !/outreachdev/i.test(pageInfo.bodyText));
check('Content stays within website design scope', !/custom web apps|scheduling|spreadsheets?|work orders|caf[eé]s?/i.test(pageInfo.bodyText));
check('Desktop has no horizontal overflow', pageInfo.width <= pageInfo.viewport, { width: pageInfo.width, viewport: pageInfo.viewport });
const artwork = await page.locator('#home img[data-film-image]').evaluate(image => ({ source: image.currentSrc || image.src, loaded: image.complete && image.naturalWidth > 0, naturalWidth: image.naturalWidth }));
check('Hero photograph loads as a local WebP', artwork.loaded && new URL(artwork.source, url).origin === new URL(url).origin && new URL(artwork.source, url).pathname.endsWith('.webp'), artwork);
// Opening sequence: garden loop, scroll-driven light, white, then the hero.
const introTop = await page.evaluate(() => {
  const intro = document.querySelector('[data-intro]');
  const video = intro?.querySelector('video');
  const header = document.querySelector('.site-header');
  return {
    present: !!intro,
    end: intro ? intro.offsetTop + intro.offsetHeight : 0,
    playing: !!video && !video.paused && video.readyState >= 2,
    headerHidden: getComputedStyle(header).visibility === 'hidden',
    skipVisible: !!intro?.querySelector('[data-intro-skip]')?.offsetParent,
  };
});
check('Opening sequence plays the garden loop with the header held back', introTop.present && introTop.playing && introTop.headerHidden && introTop.skipVisible, introTop);
await page.screenshot({ path: `${screenshotDir}/desktop-intro.png` });
report.screenshots.push(`${screenshotDir}/desktop-intro.png`);
await page.locator('[data-intro-light]').evaluate(canvas => {
  const context = canvas.getContext('2d');
  const drawImage = context.drawImage;
  window.__aresLightDraws = 0;
  context.drawImage = function (...args) {
    window.__aresLightDraws++;
    return drawImage.apply(this, args);
  };
});
const litNow = () => page.evaluate(() => {
  const canvas = document.querySelector('[data-intro] canvas');
  const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  let lit = 0;
  for (let i = 3; i < pixels.length; i += 4 * 97) if (pixels[i] > 0) lit++;
  return lit / Math.ceil(pixels.length / (4 * 97));
});
await page.waitForTimeout(900);
const beforeInput = await litNow();
await page.mouse.move(400, 400);
await page.mouse.wheel(0, 1);
await page.waitForTimeout(1300);
const graceFormed = await litNow();
check('The light waits for the first scroll input, then a compact grace forms on the statue', beforeInput === 0 && graceFormed > 0 && graceFormed < 0.03, { beforeInput, graceFormed });
const lightAt = async fraction => {
  await page.evaluate(([end, f]) => scrollTo({ top: (end - innerHeight) * f, behavior: 'instant' }), [introTop.end, fraction]);
  await page.waitForTimeout(250);
  return page.evaluate(() => {
    const canvas = document.querySelector('[data-intro] canvas');
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let lit = 0, white = 0;
    for (let i = 3; i < pixels.length; i += 4 * 97) { if (pixels[i] > 0) lit++; if (pixels[i] === 255 && pixels[i - 1] === 255 && pixels[i - 2] === 255 && pixels[i - 3] === 255) white++; }
    const samples = Math.ceil(pixels.length / (4 * 97));
    return { lit: lit / samples, white: white / samples };
  });
};
const lightStates = [];
for (const fraction of [0, 0.3, 0.6, 0.98]) {
  lightStates.push({ fraction, ...(await lightAt(fraction)) });
  await page.screenshot({ path: `${screenshotDir}/desktop-intro-${Math.round(fraction * 100)}.png` });
  report.screenshots.push(`${screenshotDir}/desktop-intro-${Math.round(fraction * 100)}.png`);
  if (fraction === 0.3) {
    const firstPose = await page.locator('[data-intro-light]').evaluate(canvas => canvas.toDataURL());
    await page.waitForTimeout(400);
    const secondPose = await page.locator('[data-intro-light]').evaluate(canvas => canvas.toDataURL());
    check('The grace and its rays keep moving while the visitor rests', lightStates.at(-1).lit > 0 && firstPose !== secondPose, { litFraction: lightStates.at(-1).lit, posesChanged: firstPose !== secondPose });
  }
}
check('Scrolling grows the rays until the screen is white', lightStates[0].lit < 0.03 && lightStates[1].lit > lightStates[0].lit && lightStates[2].lit > lightStates[1].lit && lightStates[3].white > 0.99, lightStates);
await page.evaluate(end => scrollTo({ top: end, behavior: 'instant' }), introTop.end);
await page.waitForTimeout(700);
const heroArrival = await page.evaluate(() => ({ heroTop: Math.round(document.querySelector('#home').getBoundingClientRect().top), headerVisible: getComputedStyle(document.querySelector('.site-header')).visibility === 'visible', loopPaused: document.querySelector('[data-intro] video').paused }));
check('The hero follows the white with the header restored and the loop paused', heroArrival.heroTop === 0 && heroArrival.headerVisible && heroArrival.loopPaused, heroArrival);
const lightDrawsAfterIntro = await page.evaluate(() => window.__aresLightDraws);
await page.waitForTimeout(400);
check('The light stops drawing once the intro is offscreen', await page.evaluate(() => window.__aresLightDraws) === lightDrawsAfterIntro);
await page.screenshot({ path: `${screenshotDir}/desktop-hero.png` });
report.screenshots.push(`${screenshotDir}/desktop-hero.png`);
await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
await page.waitForTimeout(300);
await page.locator('[data-intro-skip]').click();
await page.waitForFunction(end => Math.abs(scrollY - end) < 2, introTop.end, { timeout: 8000 }).catch(() => {});
check('Skip intro lands on the hero', await page.evaluate(end => Math.abs(scrollY - end) < 2, introTop.end));
await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += innerHeight * 0.75) { scrollTo({ top: y, behavior: 'instant' }); await new Promise(resolve => setTimeout(resolve, 180)); } });
await page.waitForTimeout(1000);
await page.screenshot({ path: `${screenshotDir}/desktop-full.png`, fullPage: true });
report.screenshots.push(`${screenshotDir}/desktop-full.png`);
const images = await page.locator('img').evaluateAll(elements => elements.map(image => ({ source: image.currentSrc || image.src, loaded: image.complete && image.naturalWidth > 0, width: image.naturalWidth, height: image.naturalHeight })));
check('Every desktop photograph loads after scrolling, including lazy scenes', images.length >= 3 && images.every(image => image.loaded), images);
check('All photograph assets are served locally', images.every(image => new URL(image.source, url).origin === new URL(url).origin), images);

await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
await page.waitForTimeout(200);
const initialProgress = await page.locator('#scroll-progress').evaluate(element => getComputedStyle(element).transform);
// The journey: the camera flies through the colonnade while the words change.
const journeyBox = await page.locator('[data-journey]').evaluate(element => ({ top: element.offsetTop, height: element.offsetHeight }));
const journeyAt = async fraction => {
  await page.evaluate(([box, f]) => scrollTo({ top: box.top + (box.height - innerHeight) * f, behavior: 'instant' }), [journeyBox, fraction]);
  await page.waitForTimeout(700);
  const path = `${screenshotDir}/desktop-journey-${Math.round(fraction * 100)}.png`;
  await page.screenshot({ path });
  report.screenshots.push(path);
  return page.evaluate(() => {
    const journey = document.querySelector('[data-journey]');
    return {
      flying: journey.classList.contains('is-flying'),
      progress: Number(journey.dataset.progress),
      shown: [...journey.querySelectorAll('[data-beat].is-shown')].map(beat => beat.className.replace('journey-beat ', '').replace(' is-shown', '')),
    };
  });
};
await page.waitForFunction(() => document.querySelector('[data-journey]')?.classList.contains('is-flying'), null, { timeout: 8000 }).catch(() => {});
const journeyStates = [];
for (const fraction of [0.05, 0.37, 0.9]) journeyStates.push(await journeyAt(fraction));
check('The colonnade flight renders and follows the scroll', journeyStates.every(state => state.flying) && journeyStates[0].progress < journeyStates[1].progress && journeyStates[1].progress < journeyStates[2].progress, journeyStates);
check('The story changes in step with the flight', journeyStates[0].shown.includes('beat-vision') && journeyStates[1].shown.includes('beat-craft') && journeyStates[2].shown.includes('beat-detail'), journeyStates);
const readingStates = [];
for (const fraction of [0.5, 0.63, 0.76]) {
  await journeyAt(fraction);
  readingStates.push(await page.locator('[data-reading-beat]').evaluate(beat => {
    const style = getComputedStyle(beat);
    const rect = beat.getBoundingClientRect();
    return { opacity: Number(style.opacity), top: rect.top, bottom: rect.bottom, viewport: innerHeight, headings: [...beat.querySelectorAll('h3')].map(heading => heading.textContent.trim()) };
  }));
}
check('All three qualities stay fully readable and steady across an extended scroll interval', readingStates.every(state => state.opacity === 1 && state.headings.length === 3 && state.top >= 0 && state.bottom <= state.viewport && Math.abs(state.top - readingStates[0].top) < 1), readingStates);
const flightFrames = await page.evaluate(() => [...document.querySelectorAll('[data-journey] canvas')].map(canvas => ({ width: canvas.width, height: canvas.height, visible: getComputedStyle(canvas).opacity === '1' })));
check('The flight canvas fills the stage', flightFrames.length === 1 && flightFrames[0].width > 0 && flightFrames[0].visible, flightFrames);
const scrolledProgress = await page.locator('#scroll-progress').evaluate(element => getComputedStyle(element).transform);
check('Reading progress responds to scrolling', initialProgress !== scrolledProgress, { initialProgress, scrolledProgress });

const conceptButtons = page.locator('button[data-concept]');
if (await conceptButtons.count()) {
  const concepts = [];
  for (const button of await conceptButtons.all()) {
    const value = await button.getAttribute('data-concept');
    await button.click();
    await page.waitForTimeout(400);
    const state = await page.locator('#concept-panel').getAttribute('data-theme');
    concepts.push({ value, state, selected: await button.getAttribute('aria-selected'), pressed: await button.getAttribute('aria-pressed') });
  }
  check('Every concept button updates the preview', concepts.every(item => item.state === item.value), concepts);
  if (await conceptButtons.first().getAttribute('role') === 'tab' && await conceptButtons.count() > 1) {
    await conceptButtons.first().click();
    await conceptButtons.first().focus();
    await page.keyboard.press('ArrowRight');
    const keyboardState = await conceptButtons.nth(1).evaluate(el => ({ focused: document.activeElement === el, selected: el.getAttribute('aria-selected') }));
    check('Concept tabs support arrow-key selection', keyboardState.focused && keyboardState.selected === 'true', keyboardState);
  } else {
    await conceptButtons.first().focus();
    await page.keyboard.press('Enter');
    check('Concept buttons support keyboard activation', await page.locator('#concept-panel').getAttribute('data-theme') === await conceptButtons.first().getAttribute('data-concept'));
  }
  const action = page.locator('[data-demo-action]').first();
  if (await action.count()) {
    await action.click();
    const status = await page.locator('#demo-status').textContent();
    check('Demo interaction produces a status', !!status?.trim(), status);
  } else check('Demo action exists', false);
} else check('Concept buttons exist', false);

await page.addInitScript(() => {
  window.__aresOpened = [];
  window.open = (...args) => { window.__aresOpened.push(args); return null; };
  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target.closest('a[href^="mailto:"]') : null;
    if (target) { event.preventDefault(); window.__aresOpened.push([target.href]); }
  }, true);
});
await page.reload({ waitUntil: 'networkidle' });
const form = page.locator('#inquiry-form');
if (await form.count()) {
  const fieldLabels = await form.locator('input:not([type="hidden"]), select, textarea').evaluateAll(fields => fields.map(el => ({ name: el.name, labeled: !!el.labels?.length || !!el.getAttribute('aria-label') || !!el.getAttribute('aria-labelledby') })));
  check('Inquiry fields have accessible labels', fieldLabels.every(field => field.labeled), fieldLabels);
  await form.locator('[name="name"]').fill('Ares browser check');
  await form.locator('[name="email"]').fill('not-an-email');
  await form.locator('[name="message"]').fill('Local validation only.');
  await form.locator('button[type="submit"]').click();
  check('An invalid email cannot open an inquiry draft', (await page.evaluate(() => window.__aresOpened)).length === 0);
  await form.locator('[name="email"]').fill('browser-check@example.com');
  if (await form.locator('[name="business"]').count()) await form.locator('[name="business"]').fill('Test business');
  const service = form.locator('[name="service"]');
  if (await service.count()) {
    if (await service.evaluate(el => el.tagName === 'SELECT')) {
      const option = await service.locator('option').evaluateAll(options => options.find(option => option.value)?.value);
      if (option) await service.selectOption(option);
    } else await service.fill('Business website');
  }
  await form.locator('[name="message"]').fill('This is an automated local browser validation. No message should be sent.');
  await form.locator('button[type="submit"]').click();
  await page.waitForTimeout(300);
  const opened = await page.evaluate(() => window.__aresOpened);
  const status = await page.locator('#inquiry-status').textContent();
  check('Inquiry opens an email draft with entered details', opened.some(args => String(args[0]).startsWith('mailto:') && decodeURIComponent(args[0]).includes('Ares browser check')), { opened, status });
} else check('Inquiry form exists', false);

for (const width of [390, 320, 768]) {
  await page.setViewportSize({ width, height: 844 });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth, overflowing: [...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1 || el.getBoundingClientRect().left < -1).slice(0, 8).map(el => ({ tag: el.tagName, class: el.className, left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right })) }));
  check(`No horizontal overflow at ${width}px`, dimensions.width <= dimensions.viewport, dimensions);
  if (width === 390) {
    const portraitHero = await page.locator('#home img[data-film-image]').evaluate(image => ({ source: image.currentSrc || image.src, loaded: image.complete && image.naturalWidth > 0 }));
    check('Phones receive the dedicated portrait hero photograph', portraitHero.loaded && new URL(portraitHero.source, url).pathname.endsWith('/ares-hero-mobile.webp'), portraitHero);
    await page.screenshot({ path: `${screenshotDir}/mobile-intro.png` });
    report.screenshots.push(`${screenshotDir}/mobile-intro.png`);
    // Navigation belongs to the site, which begins at the hero below the intro.
    await page.locator('#home').evaluate(element => element.scrollIntoView({ block: 'start', behavior: 'instant' }));
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${screenshotDir}/mobile-hero.png` });
    report.screenshots.push(`${screenshotDir}/mobile-hero.png`);
    const menu = page.locator('[data-menu-toggle]');
    check('Mobile menu trigger is visible and labeled', await menu.isVisible() && !!(await menu.getAttribute('aria-label')));
    await menu.click();
    check('Mobile menu opens accessibly', await menu.getAttribute('aria-expanded') === 'true' && await page.locator('#mobile-menu').isVisible());
    check('Mobile navigation locks background scrolling', await page.evaluate(() => getComputedStyle(document.body).overflow === 'hidden'));
    await page.keyboard.press('Shift+Tab');
    const toggleFocused = await menu.evaluate(element => document.activeElement === element);
    await page.keyboard.press('Shift+Tab');
    const lastLinkFocused = await page.locator('#mobile-menu a').last().evaluate(element => document.activeElement === element);
    await page.keyboard.press('Tab');
    const focusWrapped = await menu.evaluate(element => document.activeElement === element);
    check('Mobile menu contains keyboard focus', toggleFocused && lastLinkFocused && focusWrapped, { toggleFocused, lastLinkFocused, focusWrapped });
    await page.keyboard.press('Escape');
    check('Escape closes mobile menu', await menu.getAttribute('aria-expanded') === 'false');
    check('Escape returns focus to the menu trigger', await menu.evaluate(element => document.activeElement === element));
    await menu.click();
    await page.locator('#mobile-menu a').first().click();
    check('Mobile navigation closes after selecting a link', await menu.getAttribute('aria-expanded') === 'false');
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += innerHeight * 0.75) { scrollTo({ top: y, behavior: 'instant' }); await new Promise(resolve => setTimeout(resolve, 140)); } });
    await page.waitForTimeout(1000);
    const mobileImages = await page.locator('img').evaluateAll(elements => elements.map(image => ({ source: image.currentSrc || image.src, loaded: image.complete && image.naturalWidth > 0 })));
    check('All mobile photographs load after scrolling', mobileImages.length >= 3 && mobileImages.every(image => image.loaded), mobileImages);
    await page.screenshot({ path: `${screenshotDir}/mobile-full.png`, fullPage: true });
    report.screenshots.push(`${screenshotDir}/mobile-full.png`);
  }
}

const reducedContext = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
const reducedPage = await reducedContext.newPage();
watchErrors(reducedPage);
await reducedPage.goto(url, { waitUntil: 'networkidle' });
await reducedPage.waitForTimeout(300);
const reduced = await reducedPage.evaluate(() => ({ media: matchMedia('(prefers-reduced-motion: reduce)').matches, scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior, animations: document.getAnimations().filter(animation => animation.playState === 'running').map(animation => ({ timing: animation.effect?.getComputedTiming(), target: animation.effect?.target?.className })), headingVisible: !!document.querySelector('h1') && getComputedStyle(document.querySelector('h1')).opacity !== '0' }));
check('Reduced motion retains visible heading and disables smooth scrolling', reduced.media && reduced.headingVisible && reduced.scrollBehavior !== 'smooth', reduced);
const reducedIntro = await reducedPage.evaluate(() => ({ introHidden: getComputedStyle(document.querySelector('[data-intro]')).display === 'none', heroTop: Math.round(document.querySelector('#home').getBoundingClientRect().top), headerVisible: getComputedStyle(document.querySelector('.site-header')).visibility === 'visible', loopRequested: performance.getEntriesByType('resource').some(entry => /garden-loop/.test(entry.name)) }));
check('Reduced motion opens directly on the hero without loading the intro loop', reducedIntro.introHidden && reducedIntro.heroTop === 0 && reducedIntro.headerVisible && !reducedIntro.loopRequested, reducedIntro);
const reducedBefore = await reducedPage.locator('[data-film-image], [data-journey-still]').evaluateAll(images => images.map(image => getComputedStyle(image).transform));
await reducedPage.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += innerHeight * 0.75) { scrollTo({ top: y, behavior: 'instant' }); await new Promise(resolve => setTimeout(resolve, 100)); } });
const reducedAfter = await reducedPage.locator('[data-film-image], [data-journey-still]').evaluateAll(images => images.map(image => getComputedStyle(image).transform));
const reducedJourney = await reducedPage.evaluate(() => ({ canvasHidden: getComputedStyle(document.querySelector('[data-journey] canvas')).display === 'none', beats: [...document.querySelectorAll('[data-beat]')].map(beat => getComputedStyle(beat).opacity) }));
check('Reduced motion shows the journey as one still section with every beat visible', reducedJourney.canvasHidden && reducedJourney.beats.length === 5 && reducedJourney.beats.every(value => value === '1'), reducedJourney);
check('Reduced motion keeps every photograph stationary', reducedBefore.length >= 2 && reducedBefore.every((value, index) => value === reducedAfter[index]), { before: reducedBefore, after: reducedAfter });
const reducedContent = await reducedPage.locator('main h1, main h2, [data-reveal]').evaluateAll(elements => elements.map(element => ({ selector: element.id || element.className, opacity: getComputedStyle(element).opacity, visibility: getComputedStyle(element).visibility })));
check('Reduced motion leaves the entire story visible', reducedContent.every(element => element.opacity === '1' && element.visibility !== 'hidden'), reducedContent);

for (const viewport of [{ width: 1440, height: 1000, name: 'desktop' }, { width: 390, height: 844, name: 'mobile' }]) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto(url, { waitUntil: 'networkidle' });
  for (const [selector, name] of [['#home', 'hero'], ['#vision', 'vision'], ['#craft', 'craft'], ['#showcase', 'explorer'], ['#contact', 'contact'], ['#inquiry-form', 'form']]) {
    await captureScene(page, selector, `${viewport.name}-${name}-native`);
  }
}
check('No browser runtime or asset-loading errors', report.pageErrors.length === 0 && report.consoleErrors.length === 0 && report.requestsFailed.length === 0, { pageErrors: report.pageErrors, consoleErrors: report.consoleErrors, requestsFailed: report.requestsFailed });
await browser.close();
await writeFile(`${screenshotDir}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.checks.some(item => !item.passed) ? 1 : 0;
