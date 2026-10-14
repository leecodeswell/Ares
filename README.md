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

After the hero, a pinned stage flies a camera from the terrace (framed like the sanctuary photograph), up the steps and down a marble colonnade, through the arch in its far wall and out into open sky, while the story's words arrive in step: *Your themes. Your look.*, *walking into your world*, *Built around you*, the three qualities, and *The details make it yours* as the camera breaks into the sky. The colonnade is a real 3D scene: broad, widely spaced Corinthian columns, a moulded entablature, a coffered barrel vault (each coffer cut from slightly different stone, softly weathered and shaded into its corners), polished floor slabs and an arched far wall with a keystone, closed on the left by an outer wall with pilasters under a beamed aisle ceiling and open on the right to the clouds, lit by a low warm sun from the right. The ceiling is lit by sunlight bounced up from the floor, sun shafts fall through the columns, and the marble uses a texture coloured from the hero statue. The building never moves; only the camera does. Because the camera path is fixed, the flight is rendered offline at full quality (every shadow, shaft, reflection and bounce at its highest setting) and played on the site as a video scrubbed by the scroll, frame by frame in both directions, so the visitor's GPU does no 3D work at all. Phones get a portrait render whose view widens so the corridor stays readable. The words sit on the left, over the wall, with only a soft glow around their letters, and glide across the screen with the scroll: each passage arrives on the left, passes through the centre while it is read, and drifts off toward the sky on the right as it fades; the open view on the right stays clear. The scene is built with its wall on the right and every frame is mirrored when it is encoded. The stage ends on the showcase's background colour, so the page continues without a seam.

- `src/journey/scene.js` describes the building, materials and lighting (a ray-marched WebGL shader, used only by the offline renderer); `src/journey/camera.js` holds the camera path, keyframes from the terrace to the sky; `src/journey/journey.js` holds the beat timing and scrubs the video.
- `public/journey/` holds the flight (`flight-landscape` 1920 × 1080 and `flight-portrait` 864 × 1536, 240 frames each, as H.264 MP4 with a VP9 WebM fallback, a keyframe every four frames for quick seeking) and poster stills of its first frame. The video starts loading only as the journey approaches.
- To re-render after changing the scene or camera: `node tools/render-journey/build.mjs`, then `python3 tools/render-journey/render.py frames` (Playwright for Python; resumable; roughly 20 s a frame without a GPU), then `tools/render-journey/encode.sh frames` (ffmpeg), which also writes the poster stills.
- `src/journey/marble.webp` is a seamless marble tile; `tools/build-journey-marble.py` regenerates it (colours measured from the hero statue's marble).
- `src/journey/sky.webp` is the colonnade photograph's sky extended to a full frame; `tools/build-journey-sky.py` rebuilds it. Both tools need Python with NumPy, SciPy and Pillow (the sky also OpenCV).
- Until the video has loaded, its first frame pushes gently forward. Under reduced motion the video is never downloaded and the journey becomes one still section over that first frame with every beat visible.
- Every beat, the three qualities included, has about the same share of the flight (roughly a fifth each), and the camera moves at one even pace throughout. The qualities glide across like every other passage. `--reading-scroll` in `src/journey/journey.css` can add extra reading space to them (0 now).

### The example home pages

Each design direction in "Explore the possibilities" opens a full example home page for a fictional business: Ivory is Hollis & Rose, a cupcake atelier (`examples/bakery.html`); Botanical is Fernwood & Co., an estate agency (`examples/estate.html`); Obsidian is Ashcombe Vance, a law firm (`examples/counsel.html`). The pages are reached only from the preview's "Explore the possibilities" button, which follows the selected tab; each has a "Back to Ares" link. Their styles and scripts live in `src/examples/`. Their background photographs are rendered by `tools/build-example-backdrops.py` (warm bakery light, a sunlit garden, evening light through blinds on dark stone), since no stock-photo service is used.

### Going back to the classic site

The site as it was before the journey (separate vision, craft and detail sections) is kept on the `classic` branch. To return to it, either deploy that branch, or restore it onto `main`:

```sh
git checkout main
git restore --source classic --staged --worktree -- .
git commit -m "Return to the classic site"
```

The site opens with a pixel-art garden: a statue in an ivy courtyard whose foliage sways on a short, muted, silent loop. The welcome is lettered in ivy green on the bare wall beside the statue, in two pixel fonts (Jacquard 24 for the title, Pixelify Sans for the lines below); `intro.js` places and sizes it in the garden art's own pixels so it stays on the wall at any landscape size, and on portrait screens it sits low on the left with a soft halo. At the top of the page nothing else happens. As the visitor scrolls, a golden light shaped like a Site of Grace forms on the statue's head: a bright core, a fountain of strands that rise and arc outward, and drifting motes. Scrolling on, the grace gathers into a ball of light, which opens into slowly turning rays that lengthen, widen and fan until they merge into white, while the garden brightens beneath them, and the hero then rises out of the white. The first time through, the intro plays itself: the visitor's first scroll brings out the grace, and their second sets the page gliding at an even pace (so does a first scroll that is a flurry of three or more wheel steps, a held-down arrow key, or any scroll that carries the page past the grace into the rays) through the ball, the rays and the white, stopping just as the top of the hero peeks in at the bottom of the screen (`src/intro/autoplay.js`). Scrolling down during the glide speeds it up; scrolling up, Tab, Escape, any touch that drags back up, or Skip intro hands control straight back. After that, everything follows the scroll position, so scrolling back up reverses the light. The sequence lives in `src/intro/` (script, styles, and `grace.js`, which draws the light) and `public/intro/` (loop video and poster). `grace.js` draws at 1208 × 680, the garden art's own resolution for the visible crop, and enlarges with nearest-neighbour scaling, so the light has the same detail as the foliage. It animates only while visible; hidden tabs and reduced motion stop it. A **Skip intro** button jumps straight to the hero, and the header returns once the site begins. Visitors who prefer reduced motion never get the auto-play, skip the sequence entirely and never download the loop.

### The statue's turn

Nothing stops for the statue: as the visitor scrolls on past the hero, Ares lowers his gaze as if watching them go by, first his eyes coming level and his head stirring, then bowing his head and neck toward the colonnade below. He starts as soon as his whole head has risen into view (his chin clears the bottom of the screen) and lands on his last frame just before his eyes slip under the site header, about five or six wheel steps in all (`TURN_START`, `TURN_END`, `EYES` and `CHINS` in `src/hero/statue.js`, measured from where his eye and chin actually are on screen). The opening pose is the photograph itself; the turn is drawn on top of it in a canvas that shares the photograph's box and its scroll-linked push and drift.

Nothing on the statue is generated or repainted. `tools/build-statue-turn.py` moves the photograph's own pixels: the head (helmet, crest, face) turns rigidly about the skull and the base of the neck, so its marble cannot change or morph; the neck bends smoothly between the head and the cloak; the carved irises slide a few pixels inside the lids; and the columns and sky the head uncovers are rebuilt once, as a still plate, from the visible parts of the same columns (in a space where their perspective lean is straightened) and from the open sky. Each of the 24 frames per photograph (desktop and portrait) is stored as a small WebP of only the pixels that differ from the photo, in `src/hero/statue/`. The outlines, the head/neck split, pivots, angles and timing are in `tools/statue-turn/desktop.json` and `mobile.json`; rerun `python3 tools/build-statue-turn.py` after changing them (it needs Python with NumPy, SciPy, Pillow and OpenCV). Under reduced motion there is no hold, no turn, and the frames are never downloaded. The site as it was before the turn is kept on the `backup/before-statue-turn` branch.

Scroll-linked scale and vertical drift give the photographs a slow camera-like movement. Scrolling stays native and is never intercepted, and reduced-motion mode stops image and text transforms. No autoplay sound or remote image service is required. Fonts are also served locally.

See [the visual direction notes](docs/visual-direction.md) for image compositions and animation limits.

## Checks

With the development server running, execute the repeatable browser audit:

```sh
npm run test:browser
```

The cloud machine provides `/usr/bin/chromium`. Override `ARES_CHROMIUM_PATH` on another machine and `ARES_TEST_URL` to test a different server. Reports and screenshots are saved to `/tmp/ares-shots` by default. See [tests/README.md](tests/README.md).

The audit checks the opening sequence (loop playback, the light growing to white, the one-time auto-play with its speed-up and cancel paths, the hero handoff, Skip intro, and the reduced-motion bypass), the journey video scrubbing forward and back in step with its words; desktop, tablet, and narrow mobile layouts; image loading and responsive sources; scroll-linked motion and reduced-motion alternatives; design tabs with keyboard arrows; mobile menu focus wrapping and Escape; field labels and email-draft behavior; and browser errors. Automated checks intercept email links so tests never contact anyone. Photo and gradient contrast should also be visually inspected when the artwork or typography changes.

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
