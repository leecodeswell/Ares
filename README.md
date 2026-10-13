# Ares by Lee Thompson

A cinematic website design showcase built with Vite and vanilla JavaScript. The story centers on **your themes, your look, and your business**, moving through marble portraiture, a cloud-level colonnade, and sculptural details. Three live design directions, mobile navigation, and an email-draft inquiry form make the site useful to explore.

## Run locally

Requires Node.js 20.19+ or 22.12+ (validated with Node.js 24).

```sh
# From this repository's root:
npm ci --cache /tmp/ares-npm-cache
npm run dev -- --port 5173 --strictPort
```

```sh
npm run build
npm run preview -- --port 4173 --strictPort
```

The production output is `dist/`. Fonts are served locally; the site does not depend on a remote font service.

## Contact behavior

The inquiry form validates its fields and opens an email draft addressed to Lee. Visitors review and send it in their own email application. There is no form backend, stored submission, or automatic delivery. An explicit draft link remains available after submission.

## Imagery and motion

Four original AI-generated stills in `public/images/` form a coordinated, pale ivory Greek world. They include a separate portrait composition for narrow screens. All are optimized WebP assets; their combined size is about 580 KB. The opening image loads eagerly, while later scenes load lazily.

Scroll-linked scale and vertical drift give the photographs a slow camera-like movement. Scrolling stays native, links remain available throughout the story, and reduced-motion mode stops image and text transforms. No video, autoplay sound, scroll interception, or remote image service is required. Fonts are also served locally.

See [the visual direction notes](docs/visual-direction.md) for image compositions and animation limits.

## Checks

With the development server running, execute the repeatable browser audit:

```sh
npm run test:browser
```

The cloud machine provides `/usr/bin/chromium`. Override `ARES_CHROMIUM_PATH` on another machine and `ARES_TEST_URL` to test a different server. Reports and screenshots are saved to `/tmp/ares-shots` by default. See [tests/README.md](tests/README.md).

The audit checks desktop, tablet, and narrow mobile layouts; image loading and responsive sources; scroll-linked motion and reduced-motion alternatives; design tabs with keyboard arrows; mobile menu focus wrapping and Escape; field labels and email-draft behavior; and browser errors. Automated checks intercept email links so tests never contact anyone. Photo and gradient contrast should also be visually inspected when the artwork or typography changes.

## Deployment

This is a static frontend. `npm run build` produces `dist/` for a static host. No backend credentials are needed. The inquiry form opens an email draft and requires the visitor's email app to send it.

No deployment is configured or performed by these scripts. For cloud development, work in the existing checkout; tasks are already isolated, so a new Git worktree is unnecessary.
