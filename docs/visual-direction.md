# Visual direction

Ares pairs monumental classical imagery with a quiet editorial layout. The central message is “Your themes. Your look. To match your business.” Warm ivory, muted limestone, understated sage and gold, and generous serif typography keep the website welcoming and readable.

The brand mark is a simple fluted Doric column in muted gold. The same silhouette appears in the header, footer signature, and browser icon.

## Original image assets

The images were generated specifically for this project with the image-generation tool available in Codex, then encoded as WebP. They are still images, not video. No third-party client photographs or Pear website assets are included.

| Asset | Dimensions | Composition |
| --- | --- | --- |
| `ares-hero.webp` | 1672 × 941 | Ares portrait on the right; pale sky and clouds leave room for the opening typography. |
| `ares-hero-mobile.webp` | 941 × 1672 | A portrait reframe of the same statue with room above and below for navigation and text. |
| `ares-sanctuary.webp` | 1672 × 941 | A marble colonnade at cloud level, with a deep corridor and quiet space to the left. The journey's starting frame and the source of its two flight layers. |

The imagery keeps the material pale and realistic: no weapons, bright gold armor, glitter effects, or decorative text baked into the photographs. Website text remains live HTML.

## Opening sequence

The site opens on a pixel-art statue in an ivy courtyard. In the garden loop only the green foliage sways; marble and wall stay still. The palette is muted to sit beside the site's ivory and sage.

Scrolling through roughly the first one and a half screen heights reveals a small gold flame above the statue's head. Layered amber, pale gold, and ivory form a slender, gently bending tongue of light; fine motes rise around it. It stays compact through the first half of the sequence, then its halo opens into a pale wash across the whole garden. The screen reaches pure white, and the hero rises through a soft white gradient. The garden keeps looping beneath the light, so starting to scroll never causes a jump.

| Asset | Size | Purpose |
| --- | --- | --- |
| `public/intro/garden-loop.webm`, `.mp4` | 1920 × 1080, 4 s loop | Swaying garden; WebM first, MP4 fallback |
| `public/intro/poster.webp` | 1208 × 680 | First paint, before the loop is ready |
| `src/intro/flame.js` | 960 × 540 drawing grid | Live gold flame and rising motes, at three times the old sprite's resolution on each axis; nearest-neighbour scaling keeps its pixels aligned with the garden crop |

On narrow or tall screens the frame is cropped so the statue's head stays in view, and the light is drawn on the same crop. The site header and reading progress are held back until the hero arrives, and the progress bar measures the site rather than the intro. Under `prefers-reduced-motion: reduce`, the sequence is not shown and the site opens on its hero.

The flame changes pose at up to 24 frames per second while visible. It stops after the white handoff, outside the viewport, in a hidden tab, or under reduced motion.

## Motion

Native scroll events update a single animation frame at a time. The hero's image moves slowly within an oversized frame, scaling from 1.04 to 1.21 on desktop with up to 80 px of upward drift (phones: 1.04–1.13 and 30 px). As the hero scrolls away, ARES slides left while the eyebrow and signature slide right and the tagline drifts left.

## The journey

The middle of the site is one flight through a real 3D colonnade built to match the sanctuary photograph. Two rows of fourteen Corinthian columns (leafy bells, attic bases, fluting and entasis) stand 3.2 m apart under a moulded entablature. A coffered barrel vault with rosettes and a rib over every pair of columns spans the corridor; a pilastered wall closes the right-hand aisle; the left is open to the photograph's sky and sea of clouds. The front corner stands on a raised block with the steps to its right and a low wall running along the terrace, as in the photograph, and the far wall has a moulded arch with a keystone.

The marble is a seamless texture whose colours were measured from the photograph's marble: warm white stone with long, branching grey-brown veins, quieter on broad walls, the vault and the polished floor slabs. A low warm sun from the left lays column shadows across the floor; sunlight bouncing up from the floor lights the vault in soft stripes; faint sun shafts hang in the air between the columns; and the sky is the photograph's own, a touch warmer. The tone curve leaves the mid-tones untouched so the sky keeps its contrast, and only rolls off sunlit highlights.

The building is fixed; the camera starts on the terrace with the front column near the centre and the corridor ahead to the right, through a slightly long lens (46°) as in the photograph. It turns toward the steps, climbs them, widens to 55° and glides down the centre of the corridor, passes through the arch about 87% of the way through the scroll, and drifts on over the clouds while lifting its gaze before the stage fades into the showcase's background colour.

| Story progress (before the reading hold stretches scroll distance) | Camera | Words |
| --- | --- | --- |
| 0–17% | On the terrace, approaching the steps | 01 / Your themes. Your look. To match your business. (lines part as before) |
| 18–34% | Up the steps, between the first columns | A website should feel like walking into your world. |
| 35–54% | Columns streaming past | 02 / Websites built from scratch. For your business. |
| 55–77% | The arch grows ahead | I. II. III., the three qualities, on a soft paper band |
| 79–97% | Through the arch, into sky | The details make it yours. |

The journey is 910% of the screen height. The added 150% belongs entirely to the qualities' fully opaque interval, giving those three messages about 243% of a screen height to read (previously 93%). They stay still while the camera glides more slowly behind them. Other beats keep their previous scroll duration. On tall phone screens the camera's view widens so the corridor stays readable, and the words sit at the top over a paper gradient. While the visitor scrolls, the scene renders at a resolution suited to the device; when scrolling stops, one crisp frame is drawn. Each beat fades and drifts in and out; text that is not on screen stays readable to screen readers, and its links leave the tab order until they are visible.

## Reduced motion

Images and all type movements stop under `prefers-reduced-motion: reduce`. The journey becomes one still section over the colonnade photograph with every beat visible in order. Apart from the opening sequence, which a visitor can skip and reduced motion bypasses, no loading sequence or mandatory animation delays navigation.

## Interaction

Ivory, Botanical, and Obsidian are fictional design explorations for a visitor's own business. They demonstrate changes in color, typography, and atmosphere without presenting invented client work. The inquiry form prepares a draft; it does not claim to deliver a message.

## Review

Check actual screenshots and browser rendering after changing images, crops, overlays, or text. Automated contrast checks cannot reliably assess every photograph or gradient. Keep the statue's eye clear of the mobile wordmark, give small text a stable light background, and verify keyboard access and reduced-motion behavior alongside the visual composition.
