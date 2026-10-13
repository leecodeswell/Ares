# Ares by Lee Thompson

A cinematic website design showcase built with Vite and vanilla JavaScript. The story centers on **your themes, your look, and your business**, moving from marble portraiture into a scroll-driven flight down a cloud-level colonnade and out into open sky. Three live design directions, mobile navigation, and an email-draft inquiry form make the site useful to explore.

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

Three original AI-generated stills in `public/images/` form a coordinated, pale ivory Greek world, including a separate portrait composition of the hero for narrow screens. All are optimized WebP assets. The opening image loads eagerly, while later scenes load lazily.

### The journey

After the hero, a pinned stage flies the camera down the colonnade from `ares-sanctuary.webp`, through the far arch and into open sky, while the story's words arrive in step: *Your themes. Your look.*, *walking into your world*, *Built around you*, the three qualities, and *The details make it yours* as the camera breaks into the sky. The flight is rendered live with WebGL from two layers made from that photograph (`src/journey/corridor.webp` and `sky.webp`, about 180 KB together), so it stays sharp at any size and follows the scrollbar exactly. A light motion blur appears only while the visitor is scrolling. The stage ends on the showcase's background colour, so the page continues without a seam.

- `src/journey/journey.js` holds the camera path, the beat timing and the shader; the comments name each tunable value.
- `tools/build-journey-layers.py` rebuilds the two layers from the photograph (Python with NumPy, SciPy, OpenCV and Pillow).
- Without WebGL the photograph itself pushes toward the arch. Under reduced motion the journey becomes one still section with every beat visible.

### Going back to the classic site

The site as it was before the journey (separate vision, craft and detail sections) is kept on the `classic` branch. To return to it, either deploy that branch, or restore it onto `main`:

```sh
git checkout main
git restore --source classic --staged --worktree -- .
git commit -m "Return to the classic site"
```

The site opens with a pixel-art garden: a statue in an ivy courtyard whose foliage sways on a short, muted, silent loop. Scrolling grows a light from the statue's head until the screen is white, and the hero then rises out of the white. The sequence lives in `src/intro/` (script, styles, light sprite) and `public/intro/` (loop video and poster), about 1.2 MB in total. A **Skip intro** button jumps straight to the hero, and the header returns once the site begins. Visitors who prefer reduced motion skip the sequence entirely and never download the loop.

Scroll-linked scale and vertical drift give the photographs a slow camera-like movement. Scrolling stays native and is never intercepted, and reduced-motion mode stops image and text transforms. No autoplay sound or remote image service is required. Fonts are also served locally.

See [the visual direction notes](docs/visual-direction.md) for image compositions and animation limits.

## Checks

With the development server running, execute the repeatable browser audit:

```sh
npm run test:browser
```

The cloud machine provides `/usr/bin/chromium`. Override `ARES_CHROMIUM_PATH` on another machine and `ARES_TEST_URL` to test a different server. Reports and screenshots are saved to `/tmp/ares-shots` by default. See [tests/README.md](tests/README.md).

The audit checks the opening sequence (loop playback, the light growing to white, the hero handoff, Skip intro, and the reduced-motion bypass); desktop, tablet, and narrow mobile layouts; image loading and responsive sources; scroll-linked motion and reduced-motion alternatives; design tabs with keyboard arrows; mobile menu focus wrapping and Escape; field labels and email-draft behavior; and browser errors. Automated checks intercept email links so tests never contact anyone. Photo and gradient contrast should also be visually inspected when the artwork or typography changes.

## Deployment

This is a static frontend. `npm run build` produces `dist/` for a static host. No backend credentials are needed. The inquiry form opens an email draft and requires the visitor's email app to send it.

No deployment is configured or performed by these scripts. For cloud development, work in the existing checkout; tasks are already isolated, so a new Git worktree is unnecessary.

### Image paths and hosting

The build uses relative asset paths, so images, fonts, styles, and scripts work both at a domain root and below a repository path such as `/Ares/`. Deploy the **contents of `dist/`**, produced by `npm run build`, rather than the source `index.html`.

GitHub's repository file viewer is not a running website. To view the site on your computer, clone the repository, open a terminal in its `Ares` folder, install dependencies with `npm ci`, and run `npm run dev`. Use `npm run preview` after a production build to inspect the build locally.

Run `npm run build && npm run test:assets` to verify the production images and other assets under both root and repository-path hosting. This test starts its own local servers and needs no running development server.
