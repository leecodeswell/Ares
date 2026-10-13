# Visual direction

Ares pairs monumental classical imagery with a quiet editorial layout. The central message is “Your themes. Your look. To match your business.” Warm ivory, muted limestone, understated sage and gold, and generous serif typography keep the website welcoming and readable.

## Original image assets

The images were generated specifically for this project with the image-generation tool available in Codex, then encoded as WebP. They are still images, not video. No third-party client photographs or Pear website assets are included.

| Asset | Dimensions | Composition |
| --- | --- | --- |
| `ares-hero.webp` | 1672 × 941 | Ares portrait on the right; pale sky and clouds leave room for the opening typography. |
| `ares-hero-mobile.webp` | 941 × 1672 | A portrait reframe of the same statue with room above and below for navigation and text. |
| `ares-sanctuary.webp` | 1672 × 941 | A marble colonnade at cloud level, with a deep corridor and quiet space to the left. |
| `ares-detail.webp` | 1672 × 941 | Draped stone and a resting marble hand on the left, soft open air to the right. |

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

Native scroll events update a single animation frame at a time. Each visible film scene receives a progress value, and its image moves slowly within an oversized frame. The hero and the pinned vision scene carry the strongest movement: on desktop their images scale from 1.04 to 1.21 with up to 80 px of upward drift (phones: 1.04–1.13 and 30 px). The detail scene keeps the gentler 1.04–1.105 and 28 px (phones: 1.04–1.065 and 10 px).

Type moves with the images. As the hero scrolls away, ARES slides left while the eyebrow and signature slide right and the tagline drifts left. In the vision scene each heading line crosses the stage in its own direction, 8–17% of the viewport width (less on phones), never past the page margin, and the lines align halfway through the pin so the phrase reads cleanly at its centre.

Only visible film scenes need a transform compositing hint. Images and all type movements stop under `prefers-reduced-motion: reduce`, and the identity scene becomes an ordinary reading section. Apart from the opening sequence, which a visitor can skip and reduced motion bypasses, no loading sequence or mandatory animation delays navigation.

## Interaction

Ivory, Botanical, and Obsidian are fictional design explorations for a visitor's own business. They demonstrate changes in color, typography, and atmosphere without presenting invented client work. The inquiry form prepares a draft; it does not claim to deliver a message.

## Review

Check actual screenshots and browser rendering after changing images, crops, overlays, or text. Automated contrast checks cannot reliably assess every photograph or gradient. Keep the statue's eye clear of the mobile wordmark, give small text a stable light background, and verify keyboard access and reduced-motion behavior alongside the visual composition.
