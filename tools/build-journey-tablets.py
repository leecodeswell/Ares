#!/usr/bin/env python3
"""Build the chiselled stone tablets the journey's words are cut into.

Each tablet is rendered as a height map and lit, so it reads as real stone:
an arch-topped slab with a worn, chipped edge and a bevel, a mottled,
pitted face with a few hairline cracks, and the words cut into it with a
V-shaped chisel groove (deepest along each stroke's centre, catching light
on one wall and shadow on the other). Key words keep a trace of old gilding
in their grooves.

Writes public/journey/tablets/<name>.webp (RGBA). Needs NumPy, SciPy, Pillow.
usage: python3 tools/build-journey-tablets.py
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
FONT = ROOT / "tools" / "journey-tablets" / "Cinzel.ttf"
OUT = ROOT / "public" / "journey" / "tablets"

# Each line is a list of (text, gilded) runs; the last line of a tablet may
# be set smaller, as on the site.
TABLETS = {
    "vision": [[("YOUR THEMES.", False)], [("YOUR LOOK.", False)], [("TO MATCH ", False), ("YOUR BUSINESS.", True)]],
    "world": [[("A WEBSITE SHOULD", False)], [("FEEL LIKE WALKING", False)], [("INTO ", False), ("YOUR WORLD.", True)]],
    "craft": [[("WEBSITES BUILT", False)], [("FROM ", False), ("SCRATCH.", True)], [("FOR YOUR BUSINESS.", False)]],
    "quality-1": [[("I.", True)], [("A LOOK THAT FEELS", False)], [("LIKE ", False), ("YOU.", True)]],
    "quality-2": [[("II.", True)], [("EASY TO USE.", False)], [("EVERYWHERE.", True)]],
    "quality-3": [[("III.", True)], [("EVERY DETAIL,", False)], [("CONSIDERED.", True)]],
}

SIZE = 92          # cap size in px for full lines
LAST = 0.8         # the last line's size, relative
LEADING = 1.32
PAD_X = 120
PAD_TOP = 150      # room for the arch
PAD_BOTTOM = 96
SEED = 11


def font(size, weight=600):
    f = ImageFont.truetype(str(FONT), size)
    f.set_variation_by_axes([weight])
    return f


def fbm(shape, rng, octaves=6, base=0.012):
    h, w = shape
    out = np.zeros(shape, np.float32)
    amp = 1.0
    for o in range(octaves):
        freq = base * (2 ** o)
        gh, gw = max(2, int(h * freq) + 2), max(2, int(w * freq) + 2)
        grid = rng.random((gh, gw)).astype(np.float32)
        layer = ndimage.zoom(grid, (h / (gh - 1), w / (gw - 1)), order=3)[:h, :w]
        out += amp * layer
        amp *= 0.5
    out -= out.min()
    return out / max(1e-6, out.max())


def layout(lines):
    big, small = font(SIZE), font(int(SIZE * LAST))
    rows = []
    for i, runs in enumerate(lines):
        f = small if i == len(lines) - 1 and len(lines) > 2 else big
        widths = [f.getlength(t) for t, _ in runs]
        rows.append((runs, widths, f))
    width = max(sum(w) for _, w, _ in rows)
    return rows, width


def build(name, lines, rng):
    rows, text_w = layout(lines)
    line_h = int(SIZE * LEADING)
    W = int(text_w + 2 * PAD_X)
    H = int(PAD_TOP + line_h * len(rows) + PAD_BOTTOM)
    W += W % 2
    H += H % 2

    # ---- the slab's outline: an arched top, straight sides, worn and chipped
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    margin = 18
    radius = (W - 2 * margin) / 2
    arch_cy = margin + radius * 0.42  # a low, wide arch
    inside = (xx >= margin) & (xx <= W - margin) & (yy >= arch_cy) & (yy <= H - margin)
    ell = ((xx - W / 2) / radius) ** 2 + ((yy - arch_cy) / (radius * 0.42)) ** 2 <= 1
    shape = (inside | (ell & (yy < arch_cy))).astype(np.float32)
    # wear the edge with noise, then knock out a few chips
    dist_out = ndimage.distance_transform_edt(shape)
    edge_noise = fbm((H, W), rng, 5, 0.02) - 0.5
    shape = (dist_out > 2.5 + edge_noise * 9).astype(np.float32)
    for _ in range(int(rng.integers(5, 9))):
        # chips sit on the rim
        ang = rng.uniform(0, 2 * np.pi)
        cx = W / 2 + np.cos(ang) * W * 0.55
        cy = H / 2 + np.sin(ang) * H * 0.55
        cx, cy = np.clip(cx, margin, W - margin), np.clip(cy, margin, H - margin)
        r = rng.uniform(7, 18)
        shape[((xx - cx) ** 2 + (yy - cy) ** 2) < r * r] = 0
    shape = ndimage.binary_opening(shape > 0.5, iterations=2)
    # keep the slab itself; no loose fragments floating beside it
    labels, count = ndimage.label(shape)
    if count > 1:
        sizes = ndimage.sum(shape, labels, range(1, count + 1))
        shape = labels == (int(np.argmax(sizes)) + 1)
    shape = ndimage.binary_fill_holes(shape).astype(np.float32)
    alpha = ndimage.gaussian_filter(shape, 0.8)

    # ---- height: a bevelled slab with a slightly domed, pitted face
    inner = ndimage.distance_transform_edt(shape)
    bevel = np.clip(inner / 26.0, 0, 1)
    bevel = bevel * bevel * (3 - 2 * bevel)
    height = bevel * 1.0
    height += 0.06 * fbm((H, W), rng, 6, 0.004)          # broad undulation
    height += 0.035 * fbm((H, W), rng, 5, 0.03)          # tooling
    grain = rng.random((H, W)).astype(np.float32)
    pits = ndimage.gaussian_filter((grain > 0.9965).astype(np.float32), 1.3)
    height -= 0.9 * pits                                  # small pits
    height += 0.006 * ndimage.gaussian_filter(rng.random((H, W)).astype(np.float32), 0.9)

    # hairline cracks: short wandering lines, slightly sunk
    crack = np.zeros((H, W), np.float32)
    for _ in range(int(rng.integers(2, 4))):
        x, y = rng.uniform(0.1, 0.9) * W, rng.uniform(0.6, 0.98) * H
        ang = rng.uniform(-2.6, -0.5)
        for _ in range(int(rng.integers(60, 140))):
            ang += rng.normal(0, 0.18)
            x += np.cos(ang) * 2.2
            y += np.sin(ang) * 2.2
            if 0 <= int(y) < H and 0 <= int(x) < W:
                crack[int(y), int(x)] = 1
    crack = ndimage.gaussian_filter(crack, 0.7)
    height -= 0.25 * np.clip(crack * 3, 0, 1)

    # ---- the inscription: rasterise, then cut a V-groove into the stone
    text = Image.new("L", (W, H), 0)
    gild = Image.new("L", (W, H), 0)
    d_text, d_gild = ImageDraw.Draw(text), ImageDraw.Draw(gild)
    y = PAD_TOP
    for runs, widths, f in rows:
        x = (W - sum(widths)) / 2
        for (t, g), w in zip(runs, widths):
            d_text.text((x, y), t, font=f, fill=255)
            if g:
                d_gild.text((x, y), t, font=f, fill=255)
            x += w
        y += line_h
    t = np.asarray(text).astype(np.float32) / 255
    g = ndimage.gaussian_filter(np.asarray(gild).astype(np.float32) / 255, 1.0)
    inside_stroke = ndimage.distance_transform_edt(t > 0.5)
    stroke_half = max(2.0, np.percentile(inside_stroke[t > 0.5], 92))
    groove = np.clip(inside_stroke / stroke_half, 0, 1) ** 0.85
    groove = np.maximum(groove, ndimage.gaussian_filter(t, 0.6) * 0.35)
    # a chisel leaves crisp walls: no blur beyond a hair
    height -= 0.55 * groove * (t > 0.02)

    # ---- light it: low and from the upper left, like the colonnade's sun
    gy, gx = np.gradient(ndimage.gaussian_filter(height, 0.6))
    strength = 7.0
    nx, ny, nz = -gx * strength, -gy * strength, np.ones_like(height)
    norm = np.sqrt(nx * nx + ny * ny + nz * nz)
    nx, ny, nz = nx / norm, ny / norm, nz / norm
    light = np.array([-0.55, -0.62, 0.56])
    light /= np.linalg.norm(light)
    diffuse = np.clip(nx * light[0] + ny * light[1] + nz * light[2], 0, 1)
    # cavities collect shadow: occlusion from the local height
    ao = np.clip(1 - 1.6 * (ndimage.gaussian_filter(height, 6) - height), 0.35, 1)

    # ---- the stone's colour: a warm limestone, mottled, darker in the cuts
    mottle = fbm((H, W), rng, 6, 0.008)
    speck = ndimage.gaussian_filter(rng.random((H, W)).astype(np.float32), 0.6)
    base = np.array([0.80, 0.75, 0.66])
    warm = np.array([0.72, 0.64, 0.52])
    albedo = base[None, None] * (1 - mottle[..., None] * 0.35) + warm[None, None] * mottle[..., None] * 0.35
    albedo = albedo * (1 - 0.08 * (speck[..., None] > 0.62))
    albedo *= (0.95 + 0.1 * fbm((H, W), rng, 3, 0.05))[..., None]
    dust = np.clip(groove * (t > 0.02), 0, 1)[..., None]
    albedo = albedo * (1 - 0.42 * dust)
    gold = np.array([0.74, 0.58, 0.28])
    albedo = albedo * (1 - 0.8 * g[..., None] * dust) + gold[None, None] * 0.8 * g[..., None] * dust

    shade = 0.36 + 0.82 * diffuse
    rgb = albedo * shade[..., None] * ao[..., None]
    rgb = np.clip(rgb, 0, 1) ** (1 / 1.08)
    out = np.dstack([rgb * 255, alpha * 255]).astype(np.uint8)
    OUT.mkdir(parents=True, exist_ok=True)
    img = Image.fromarray(out, "RGBA")
    img.save(OUT / f"{name}.webp", "WEBP", quality=88, method=6)
    print(name, img.size)


def main():
    rng = np.random.default_rng(SEED)
    for name, lines in TABLETS.items():
        build(name, lines, rng)


if __name__ == "__main__":
    main()
