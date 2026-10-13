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

## Motion

Native scroll events update a single animation frame at a time. Each visible film scene receives a progress value, and its image moves slowly within an oversized frame. Desktop image scale stays between 1.04 and 1.105, with no more than 28 px of upward drift. Narrow screens use a smaller movement: scale 1.04–1.065 and drift up to 10 px.

Only visible film scenes need a transform compositing hint. Images and headline movements stop under `prefers-reduced-motion: reduce`, and the identity scene becomes an ordinary reading section. No loading sequence or mandatory animation delays navigation.

## Interaction

Ivory, Botanical, and Obsidian are fictional design explorations for a visitor's own business. They demonstrate changes in color, typography, and atmosphere without presenting invented client work. The inquiry form prepares a draft; it does not claim to deliver a message.

## Review

Check actual screenshots and browser rendering after changing images, crops, overlays, or text. Automated contrast checks cannot reliably assess every photograph or gradient. Keep the statue's eye clear of the mobile wordmark, give small text a stable light background, and verify keyboard access and reduced-motion behavior alongside the visual composition.
