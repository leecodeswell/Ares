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

After the hero, a pinned stage flies a camera from the terrace (framed like the sanctuary photograph), up the steps and down a marble colonnade, through the arch in its far wall and out into open sky, while the story's words arrive in step: *Your themes. Your look.*, *walking into your world*, *Built around you*, the three qualities, and *The details make it yours* as the camera breaks into the sky. The colonnade is a real 3D scene: Corinthian columns, a moulded entablature, a coffered barrel vault, a pilastered wall on the right, polished floor slabs and an arched far wall with a keystone, lit by a low warm sun. The ceiling is lit by sunlight bounced up from the floor, sun shafts fall through the columns, and the marble uses a texture coloured from the site's photographs. The building never moves; only the camera does. It is drawn live in WebGL (ray marched, no libraries) inside the photograph's own sky, so it stays sharp at any size and follows the scrollbar exactly. While the visitor scrolls it renders at a resolution suited to the device (dropping shafts, bounce light and reflections on slower ones); when they stop, one full-quality frame is drawn. The stage ends on the showcase's background colour, so the page continues without a seam.

- `src/journey/scene.js` describes the building, materials and lighting; `src/journey/journey.js` holds the camera path (keyframes from the terrace to the sky), the beat timing and the rendering loop.
- `src/journey/marble.webp` is a seamless marble tile; `tools/build-journey-marble.py` regenerates it (colours measured from the photograph's marble).
- `src/journey/sky.webp` is the colonnade photograph's sky extended to a full frame; `tools/build-journey-sky.py` rebuilds it. Both tools need Python with NumPy, SciPy and Pillow (the sky also OpenCV).
- Without WebGL the photograph itself pushes gently forward. Under reduced motion the journey becomes one still section over the photograph with every beat visible.
- The three qualities have a longer reading hold: about 243vh of fully visible text, up from 93vh. An extra 150vh is added only to that interval, slowing the camera while the text stays still. Adjust `--reading-scroll` in `src/journey/journey.css` to change that added reading space.

### Going back to the classic site

The site as it was before the journey (separate vision, craft and detail sections) is kept on the `classic` branch. To return to it, either deploy that branch, or restore it onto `main`:

```sh
git checkout main
git restore --source classic --staged --worktree -- .
git commit -m "Return to the classic site"
```

The site opens with a pixel-art garden: a statue in an ivy courtyard whose foliage sways on a short, muted, silent loop. The welcome is lettered in ivy green on the bare wall beside the statue, in two pixel fonts (Jacquard 24 for the title, Pixelify Sans for the lines below); `intro.js` places and sizes it in the garden art's own pixels so it stays on the wall at any landscape size, and on portrait screens it sits low on the left with a soft halo. Nothing else happens until the visitor's first scroll input; then a golden, grace-like light kindles on the statue's head: a bright core, curling strands of light and drifting motes. Scrolling opens it into slowly turning rays that lengthen, widen and fan until they merge into white, while the garden brightens beneath them, and the hero then rises out of the white. The sequence lives in `src/intro/` (script, styles, and `grace.js`, which draws the light) and `public/intro/` (loop video and poster). `grace.js` draws at 1208 × 680, the garden art's own resolution for the visible crop, and enlarges with nearest-neighbour scaling, so the light has the same detail as the foliage. It animates only while visible; hidden tabs and reduced motion stop it. A **Skip intro** button jumps straight to the hero, and the header returns once the site begins. Visitors who prefer reduced motion skip the sequence entirely and never download the loop.

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

### GitHub Pages

The workflow in `.github/workflows/deploy-pages.yml` builds and deploys the site whenever a commit reaches `main`. Enable it once in the repository's **Settings → Pages → Build and deployment → Source → GitHub Actions**. Then open **Actions → Deploy to GitHub Pages → Run workflow** and choose `main` to publish the current version. Later pushes deploy automatically.

The default public URL is **https://leecodeswell.github.io/Ares/**. Deployment progress and errors appear in the Actions tab. If the first run fails before Pages is enabled, enable the setting and rerun the workflow. You do not need a Codespace or a running development server to view the deployed site. Edits must be committed and pushed before they appear there.

The local npm scripts only build or preview the site; deployment is performed by GitHub Actions. For cloud development, work in the existing checkout; tasks are already isolated, so a new Git worktree is unnecessary.

### Image paths and hosting

The build uses relative asset paths, so images, fonts, styles, and scripts work both at a domain root and below a repository path such as `/Ares/`. Deploy the **contents of `dist/`**, produced by `npm run build`, rather than the source `index.html`.

GitHub's repository file viewer is not a running website. To view the site on your computer, clone the repository, open a terminal in its `Ares` folder, install dependencies with `npm ci`, and run `npm run dev`. Use `npm run preview` after a production build to inspect the build locally.

Run `npm run build && npm run test:assets` to verify the production images and other assets under both root and repository-path hosting. This test starts its own local servers and needs no running development server.
