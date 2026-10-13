# Visual direction

Ares pairs monumental classical imagery with a quiet editorial layout. The central message is “Your themes. Your look. To match your business.” Warm ivory, muted limestone, understated sage and gold, and generous serif typography keep the website welcoming and readable.

## Original image assets

The images were generated specifically for this project with the image-generation tool available in Codex, then encoded as WebP. They are still images, not video. No third-party client photographs or Pear website assets are included.

| Asset | Dimensions | Composition |
| --- | --- | --- |
| `ares-hero.webp` | 1672 × 941 | Ares portrait on the right; pale sky and clouds leave room for the opening typography. |
| `ares-hero-mobile.webp` | 941 × 1672 | A portrait reframe of the same statue with room above and below for navigation and text. |
| `ares-sanctuary.webp` | 1672 × 941 | A marble colonnade at cloud level, with a deep corridor and quiet space to the left. The journey's starting frame and the source of its two flight layers. |

The imagery keeps the material pale and realistic: no weapons, bright gold armor, glitter effects, or decorative text baked into the photographs. Website text remains live HTML.

## Opening sequence

The site opens on a pixel-art statue in an ivy courtyard, a deliberate contrast to the photographic story that follows. Only the green foliage sways; marble, wall, and light stay still. The palette is muted to sit beside the site's ivory and sage.

Scrolling through roughly the first one and a half screen heights grows a pixel-art light from the statue's head. Rays lengthen, widen, and merge while the whole scene brightens in even steps, so the statue never fades separately from her surroundings. The screen reaches pure white, and the hero rises through a soft white gradient. The garden keeps looping beneath the light, so starting to scroll never causes a jump.

| Asset | Size | Purpose |
| --- | --- | --- |
| `public/intro/garden-loop.webm`, `.mp4` | 1920 × 1080, 4 s loop | Swaying garden; WebM first, MP4 fallback |
| `public/intro/poster.webp` | 1208 × 680 | First paint, before the loop is ready |
| `src/intro/light-sheet.png` | 120 frames of 320 × 180 | The light, drawn at its native pixel size and scaled with nearest-neighbour sampling |

On narrow or tall screens the frame is cropped so the statue's head stays in view, and the light is drawn on the same crop. The site header and reading progress are held back until the hero arrives, and the progress bar measures the site rather than the intro. Under `prefers-reduced-motion: reduce`, the sequence is not shown and the site opens on its hero.

## Motion

Native scroll events update a single animation frame at a time. The hero's image moves slowly within an oversized frame, scaling from 1.04 to 1.21 on desktop with up to 80 px of upward drift (phones: 1.04–1.13 and 30 px). As the hero scrolls away, ARES slides left while the eyebrow and signature slide right and the tagline drifts left.

## The journey

The middle of the site is one flight. The camera starts on the colonnade photograph exactly as it was framed before, then travels down the corridor toward the far arch, turning gently so the arch ends up centred. Near columns sweep past faster than far ones because the stone is treated as a corridor whose depth grows toward the arch; the sky beyond is infinitely far and only turns with the camera. The camera passes through the arch about 84% of the way through the journey, a warm glow marks the moment, and the open sky drifts closer before the stage fades into the showcase's background colour.

| Share of the journey | Camera | Words |
| --- | --- | --- |
| 0–17% | At the threshold, starting to move | 01 / Your themes. Your look. To match your business. (lines part as before) |
| 18–34% | Entering the corridor | A website should feel like walking into your world. |
| 35–54% | Columns streaming past | 02 / Websites built from scratch. For your business. |
| 55–77% | The arch fills the view | I. II. III., the three qualities, on a soft paper band |
| 79–97% | Through the arch, into sky | The details make it yours. |

The journey is 760% of the screen height. On phones the frame is cropped toward the corridor and the words sit at the top over a paper gradient. A motion blur along the direction of travel appears only while the visitor scrolls and settles when they stop. Each beat fades and drifts in and out; text that is not on screen stays readable to screen readers, and its links leave the tab order until they are visible.

## Reduced motion

Images and all type movements stop under `prefers-reduced-motion: reduce`. The journey becomes one still section over the colonnade photograph with every beat visible in order. Apart from the opening sequence, which a visitor can skip and reduced motion bypasses, no loading sequence or mandatory animation delays navigation.

## Interaction

Ivory, Botanical, and Obsidian are fictional design explorations for a visitor's own business. They demonstrate changes in color, typography, and atmosphere without presenting invented client work. The inquiry form prepares a draft; it does not claim to deliver a message.

## Review

Check actual screenshots and browser rendering after changing images, crops, overlays, or text. Automated contrast checks cannot reliably assess every photograph or gradient. Keep the statue's eye clear of the mobile wordmark, give small text a stable light background, and verify keyboard access and reduced-motion behavior alongside the visual composition.
