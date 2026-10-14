#!/usr/bin/env python3
"""Render the background photographs of the three example home pages.

They are photographs of light rather than of things: what a lens sees when
it is focused on someone close and the room behind falls out of focus.

  bakery   warm window light and fairy lights in a bakery, blush and cream
  estate   a sunlit garden through leaves, soft greens and gold
  counsel  late light through blinds on a dark stone wall

Written to src/examples/<name>.webp. Needs Python with NumPy, SciPy, Pillow.
usage: python3 tools/build-example-backdrops.py
"""

from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "src" / "examples"
W, H = 2400, 1500


def grid():
    y, x = np.mgrid[0:H, 0:W].astype(np.float32)
    return x / W, y / H


def mix(a, b, t):
    t = np.clip(t, 0, 1)[..., None]
    return a * (1 - t) + b * t


def disc_layer(rng, count, size_range, colours, region, softness, aperture=6):
    """Out-of-focus highlights: soft discs with a faint polygonal aperture and
    a brighter rim, as real bokeh has."""
    layer = np.zeros((H, W, 3), np.float32)
    x0, y0, x1, y1 = region
    for _ in range(count):
        r = rng.uniform(*size_range)
        cx = rng.uniform(x0, x1) * W
        cy = rng.uniform(y0, y1) * H
        colour = np.array(colours[rng.integers(len(colours))], np.float32)
        strength = rng.uniform(0.25, 1.0)
        bx0, bx1 = int(max(0, cx - r - 4)), int(min(W, cx + r + 4))
        by0, by1 = int(max(0, cy - r - 4)), int(min(H, cy + r + 4))
        if bx1 <= bx0 or by1 <= by0:
            continue
        yy, xx = np.mgrid[by0:by1, bx0:bx1].astype(np.float32)
        dx, dy = xx - cx, yy - cy
        angle = np.arctan2(dy, dx)
        # polygonal aperture: radius wobbles with the blade count
        rim = r * (1 - 0.014 * np.cos(aperture * (angle + 0.3)))
        d = np.hypot(dx, dy) / rim
        edge = np.clip((1 - d) / softness, 0, 1)
        body = edge * (0.75 + 0.25 * np.clip(d, 0, 1) ** 3)  # brighter rim
        layer[by0:by1, bx0:bx1] += body[..., None] * colour * strength
    return layer


def grain(rng, amount):
    g = rng.standard_normal((H, W)).astype(np.float32)
    g = ndimage.gaussian_filter(g, 0.6)
    return g[..., None] * amount


def finish(img, name, rng, grain_amount=2.2):
    img = img + grain(rng, grain_amount)
    out = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))
    OUT.mkdir(parents=True, exist_ok=True)
    out.save(OUT / f"{name}.webp", "WEBP", quality=84, method=6)
    small = out.resize((W // 2, H // 2), Image.LANCZOS)
    small.save(OUT / f"{name}-small.webp", "WEBP", quality=82, method=6)
    print(f"wrote src/examples/{name}.webp ({(OUT / f'{name}.webp').stat().st_size // 1024} KB)")


def bakery():
    rng = np.random.default_rng(3)
    x, y = grid()
    cream = np.array([246, 234, 222], np.float32)
    blush = np.array([236, 196, 190], np.float32)
    warm = np.array([196, 150, 120], np.float32)
    # window light from the upper left, warm shadow lower right
    light = np.clip(1.15 - np.hypot(x - 0.18, y - 0.12) * 1.25, 0, 1)
    img = mix(warm, blush, 0.35 + 0.65 * light)
    img = mix(img, cream, light ** 2)
    # a soft band of a pastry counter far behind, out of focus
    counter = np.exp(-((y - 0.78) / 0.07) ** 2) * 0.35
    img = mix(img, np.array([214, 172, 150], np.float32), counter)
    # strings of fairy lights and glints
    gold = (255, 214, 150)
    pale = (255, 238, 214)
    rose = (250, 200, 196)
    lights = disc_layer(rng, 70, (18, 70), [gold, pale, rose], (0.0, 0.0, 1.0, 0.62), 0.08)
    lights = ndimage.gaussian_filter(lights, (1.2, 1.2, 0))
    big = disc_layer(rng, 16, (90, 190), [pale, rose, gold], (0.0, 0.05, 1.0, 0.95), 0.25)
    big = ndimage.gaussian_filter(big, (6, 6, 0))
    img = img + lights * 0.42 + big * 0.16
    # gentle vignette
    v = np.clip(1 - 0.32 * (np.hypot(x - 0.45, y - 0.42) ** 1.6), 0, 1)
    img = img * v[..., None]
    finish(img, "bakery", rng)


def estate():
    rng = np.random.default_rng(5)
    x, y = grid()
    deep = np.array([52, 70, 52], np.float32)
    sage = np.array([138, 158, 120], np.float32)
    sun = np.array([236, 228, 190], np.float32)
    # sun high on the right through the trees
    glow = np.clip(1.1 - np.hypot(x - 0.82, y - 0.16) * 1.35, 0, 1)
    base = mix(deep, sage, 0.25 + 0.75 * np.clip(glow + 0.25 * (1 - y), 0, 1))
    base = mix(base, sun, glow ** 2.2)
    # foliage masses: low-frequency noise into leaf-shaped shadows
    noise = ndimage.gaussian_filter(rng.standard_normal((H // 8, W // 8)), 6)
    noise = np.array(Image.fromarray(noise.astype(np.float32)).resize((W, H), Image.BICUBIC))
    noise = (noise - noise.min()) / (noise.max() - noise.min())
    shade = np.clip((noise - 0.45) * 2.4, 0, 1) * (1 - glow) * 0.6
    img = mix(base, deep * 0.7, shade)
    leaf = (196, 214, 150)
    light = (250, 244, 206)
    bright = disc_layer(rng, 120, (14, 52), [light, leaf, light], (0.35, 0.0, 1.0, 0.7), 0.12, aperture=7)
    bright = ndimage.gaussian_filter(bright, (1.5, 1.5, 0))
    soft = disc_layer(rng, 22, (80, 200), [leaf, light], (0.0, 0.0, 1.0, 1.0), 0.3, aperture=7)
    soft = ndimage.gaussian_filter(soft, (8, 8, 0))
    img = img + bright * 0.38 * (0.3 + glow[..., None]) + soft * 0.12
    # a dark out-of-focus leaf crossing the lower left corner
    yy, xx = y - 0.92, x - 0.08
    leaf_shape = np.exp(-((xx * 0.9 + yy * 0.4) / 0.11) ** 2 - ((xx * 0.4 - yy * 0.9) / 0.32) ** 2)
    img = mix(img, deep * 0.45, ndimage.gaussian_filter(leaf_shape, 18) * 0.85)
    v = np.clip(1 - 0.25 * (np.hypot(x - 0.6, y - 0.4) ** 1.8), 0, 1)
    img = img * v[..., None]
    finish(img, "estate", rng)


def counsel():
    rng = np.random.default_rng(9)
    x, y = grid()
    # dark honed stone: layered noise, a few soft veins
    n1 = ndimage.gaussian_filter(rng.standard_normal((H // 4, W // 4)), 10)
    n1 = np.array(Image.fromarray(n1.astype(np.float32)).resize((W, H), Image.BICUBIC))
    n2 = ndimage.gaussian_filter(rng.standard_normal((H // 2, W // 2)), 2.2)
    n2 = np.array(Image.fromarray(n2.astype(np.float32)).resize((W, H), Image.BICUBIC))
    # soft clouded marbling rather than drawn veins
    n3 = ndimage.gaussian_filter(rng.standard_normal((H // 3, W // 3)), 4)
    n3 = np.array(Image.fromarray(n3.astype(np.float32)).resize((W, H), Image.BICUBIC))
    veins = np.clip(np.abs(n3) * 1.6 - 0.15, 0, 1) * 0.35
    stone = 20 + n1 * 22 + n2 * 4 + veins * 14
    img = np.stack([stone * 1.0, stone * 0.98, stone * 1.02], -1)
    # late sun through blinds: slanted bars of warm light with soft edges,
    # widening and fading away from the window (upper right)
    u = (x * 0.62 - y * 0.78)  # across the bars
    v = (x * 0.78 + y * 0.62)  # along the bars
    period = 0.075
    phase = (u / period) % 1.0
    bar = np.clip((0.55 - np.abs(phase - 0.5) * 2) / 0.35, 0, 1)
    bar = ndimage.gaussian_filter(bar, 7)
    # the window's mullion interrupts the slats
    bar *= 1 - 0.85 * np.exp(-((v - 0.86) / 0.025) ** 2)
    patch = np.exp(-((u - 0.06) / 0.2) ** 2) * np.clip(1.25 - np.abs(v - 0.98) * 1.6, 0, 1)
    champagne = np.array([255, 214, 160], np.float32)
    lit = bar * patch
    img = img + lit[..., None] * champagne * 0.36
    # the light picks up the stone's texture
    img = img + (lit * (n2 * 6 + veins * 26))[..., None]
    # dust hanging in the beam
    dust = disc_layer(rng, 90, (1.2, 3.2), [(255, 226, 180)], (0.25, 0.0, 1.0, 0.9), 0.6)
    img = img + dust * 0.35 * patch[..., None]
    v2 = np.clip(1 - 0.45 * (np.hypot(x - 0.62, y - 0.42) ** 1.5), 0, 1)
    img = img * v2[..., None]
    finish(img, "counsel", rng, grain_amount=2.8)


if __name__ == "__main__":
    bakery()
    estate()
    counsel()
