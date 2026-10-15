#!/usr/bin/env python3
"""Build the frames of Ares lowering his gaze (src/hero/statue-*.webp).

Nothing is generated or repainted on the statue. Each frame moves the
photograph's own pixels:

  * the head (helmet, crest, face, ear) turns rigidly, so its marble and
    carving cannot change or morph; only resampling touches it;
  * the neck bends smoothly between the head and the cloak, so it stays
    joined at both ends; the cloak, shoulder and everything else stay put;
  * the carved irises slide inside the eyelids (eyes first, then the head);
  * the columns and sky the head uncovers are rebuilt once, as a static
    plate, from the visible parts of the same columns (the columns lean in
    perspective, so they are rebuilt in a straightened space).

Every frame is compared with the photograph and only the pixels that differ
are kept (with a soft edge), so the overlay leaves the rest of the photo
exactly as it is. Frame 0 is never stored: the page shows the photograph.

Masks and parameters live in tools/statue-turn/<variant>.json.
Needs Python with NumPy, SciPy, Pillow and OpenCV.

usage: python3 tools/build-statue-turn.py [desktop|mobile ...] [--debug DIR]
"""

import json
import math
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
DEBUG_DIR = None
SPEC_DIR = ROOT / "tools" / "statue-turn"
OUT_DIR = ROOT / "src" / "hero"


# ---------------------------------------------------------------- utilities

def load_rgb(path):
    return np.asarray(Image.open(path).convert("RGB")).astype(np.float32)


def polygon_mask(shape, polygon, supersample=4):
    """Anti-aliased polygon coverage in [0, 1]."""
    h, w = shape
    big = Image.new("L", (w * supersample, h * supersample), 0)
    pts = [((x + 0.5) * supersample, (y + 0.5) * supersample) for x, y in polygon]
    ImageDraw.Draw(big).polygon(pts, fill=255)
    small = big.resize((w, h), Image.BOX)
    return np.asarray(small).astype(np.float32) / 255.0


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def ease(e0, e1, x):
    """Scalar smoothstep for the choreography."""
    t = min(1.0, max(0.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


def ease_in_out(e0, e1, x):
    """Slower start and finish than smoothstep (quintic smootherstep)."""
    t = min(1.0, max(0.0, (x - e0) / (e1 - e0)))
    return t * t * t * (t * (t * 6 - 15) + 10)


def rotate_about(px, py, cx, cy, angle):
    """Rotate points visually counter-clockwise on screen (y down) by angle
    (radians): a point right of the pivot moves up, one left of it moves down."""
    dx, dy = px - cx, py - cy
    c, s = np.cos(angle), np.sin(angle)
    return cx + dx * c + dy * s, cy - dx * s + dy * c


def sample(image, x, y, order=1):
    """Sample a single-channel image at float coordinates (clamped)."""
    return ndimage.map_coordinates(image, [y, x], order=order, mode="nearest")


def remap(image, mapx, mapy, interpolation=cv2.INTER_LANCZOS4, outside=None):
    """Resample at float coordinates. Pixels from beyond the photo's edge are
    replicated, or set to `outside` (e.g. 0 for a layer's coverage, so
    nothing is invented past the frame)."""
    if outside is None:
        return cv2.remap(
            image, mapx.astype(np.float32), mapy.astype(np.float32),
            interpolation, borderMode=cv2.BORDER_REPLICATE,
        )
    return cv2.remap(
        image, mapx.astype(np.float32), mapy.astype(np.float32),
        interpolation, borderMode=cv2.BORDER_CONSTANT, borderValue=outside,
    )


# ------------------------------------------------------------ the plate

class Straight:
    """Maps between the photo and a space where the leaning columns are
    vertical. All column edges pass through a vanishing point far above."""

    def __init__(self, vanish, ref_y):
        self.vx, self.vy = vanish
        self.ref = ref_y

    def factor(self, y):
        return (self.ref - self.vy) / (y - self.vy)

    def to_straight(self, x, y):
        return self.vx + (x - self.vx) * self.factor(y), y

    def to_photo(self, xs, y):
        return self.vx + (xs - self.vx) / self.factor(y), y


def relax(image, hole, valid, iterations):
    """Jacobi relaxation of Laplace's equation inside `hole`; `valid` pixels
    are fixed, anything else outside the hole is ignored (Neumann edge)."""
    img = image.copy()
    weight = (hole | valid).astype(np.float32)
    kernel = np.array([[0, 1, 0], [1, 0, 1], [0, 1, 0]], np.float32)
    w_sum = cv2.filter2D(weight, -1, kernel, borderType=cv2.BORDER_CONSTANT)
    for _ in range(iterations):
        acc = np.stack([cv2.filter2D(img[..., c] * weight, -1, kernel, borderType=cv2.BORDER_CONSTANT)
                        for c in range(img.shape[2])], -1)
        img[hole] = (acc / np.maximum(w_sum, 1e-6)[..., None])[hole]
    return img


def harmonic_fill(image, valid, hole, iterations=3000):
    """Fill `hole` smoothly from the `valid` pixels around it (Laplace),
    coarse-to-fine so wide holes converge."""
    out = image.copy()
    if not hole.any():
        return out
    ys, xs = np.nonzero(hole)
    y0, y1 = max(0, ys.min() - 8), min(image.shape[0], ys.max() + 9)
    x0, x1 = max(0, xs.min() - 8), min(image.shape[1], xs.max() + 9)
    sub = out[y0:y1, x0:x1].astype(np.float32)
    h_sub = hole[y0:y1, x0:x1]
    v_sub = valid[y0:y1, x0:x1] & ~h_sub
    if v_sub.any():
        sub[h_sub] = sub[v_sub].mean(axis=0)
    # coarse solve
    fs = 4
    sh, sw = max(2, sub.shape[0] // fs), max(2, sub.shape[1] // fs)
    small = cv2.resize(sub, (sw, sh), interpolation=cv2.INTER_AREA)
    vf = cv2.resize(v_sub.astype(np.float32), (sw, sh), interpolation=cv2.INTER_AREA)
    hf = cv2.resize(h_sub.astype(np.float32), (sw, sh), interpolation=cv2.INTER_AREA)
    small_valid = vf > 0.99
    small_hole = (hf > 0) & ~small_valid
    small = relax(small, small_hole, small_valid, iterations)
    guess = cv2.resize(small, (sub.shape[1], sub.shape[0]), interpolation=cv2.INTER_LINEAR)
    sub[h_sub] = guess[h_sub]
    sub = relax(sub, h_sub, v_sub, iterations // 6)
    out[y0:y1, x0:x1][h_sub] = sub[h_sub]
    return out


def column_model(block, known, sigma):
    """profile(x) * shade(y) fitted to the known pixels of a straightened
    column block. Returns profile (w, 3), shade (h,), the rows that had data."""
    bh, bw, _ = block.shape
    profile = np.full((bw, 3), np.nan, np.float32)
    counts = known.sum(axis=0)
    for c in range(3):
        values = np.where(known, block[..., c], np.nan)
        with np.errstate(all="ignore"):
            profile[:, c] = np.nanmedian(values, axis=0)
    profile[counts < 4] = np.nan
    lum_p = np.nanmean(profile, axis=1)
    ratio = np.where(known, block.mean(axis=2) / np.maximum(lum_p[None, :], 1), np.nan)
    rows = known.sum(axis=1) >= max(3, bw // 10)
    shade = np.full(bh, np.nan, np.float32)
    with np.errstate(all="ignore"):
        shade[rows] = np.nanmedian(ratio[rows], axis=1)
    return profile, shade, rows


def fill_nan_1d(values):
    idx = np.arange(len(values))
    good = ~np.isnan(values)
    if not good.any():
        return np.ones_like(values)
    return np.interp(idx, idx[good], values[good]).astype(np.float32)


def build_plate(photo, hole, spec, rng, debug=None):
    """Rebuild what is behind the moving head inside `hole`: columns from
    their own visible parts (with veins borrowed from fully visible stretches
    of marble), sky gaps by smooth interpolation."""
    h, w, _ = photo.shape
    straight = Straight(spec["vanish"], spec["straight_ref_y"])
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
    f = straight.factor(ys)
    src_x = straight.vx + (xs - straight.vx) / f
    flat = remap(photo, src_x, ys, cv2.INTER_CUBIC)
    flat_hole = remap(hole.astype(np.float32), src_x, ys, cv2.INTER_LINEAR) > 0.01
    known = ~flat_hole
    # statistics only from pixels well clear of the head's edge
    known_core = ndimage.binary_erosion(known, iterations=spec.get("edge_guard", 5), border_value=1)
    known_near = ndimage.binary_erosion(known, iterations=2, border_value=1)

    # the vertical light falloff shared by all columns, from fully visible stretches
    refs = []
    for x0, y0, x1, y1 in spec["donors"]:
        blk = flat[y0:y1, x0:x1]
        prof, shade, rows = column_model(blk, np.ones(blk.shape[:2], bool), 30)
        sh = np.full(h, np.nan, np.float32)
        sh[y0:y1] = shade / np.nanmedian(shade)
        refs.append(sh)
    with np.errstate(all="ignore"):
        global_shade = np.nanmean(np.stack(refs), axis=0)
    global_shade = ndimage.gaussian_filter1d(fill_nan_1d(global_shade), 30, mode="nearest")

    # vein donors: residual texture of fully visible column marble
    donors = []
    for x0, y0, x1, y1 in spec["donors"]:
        blk = flat[y0:y1, x0:x1]
        prof, shade, rows = column_model(blk, np.ones(blk.shape[:2], bool), 30)
        shade = ndimage.gaussian_filter1d(fill_nan_1d(shade), 20, mode="nearest")
        donors.append(blk - prof[None] * shade[:, None, None])

    plate = flat.copy()
    for band in spec["bands"]:
        bx0, bx1 = int(math.floor(band["x"][0])), int(math.ceil(band["x"][1]))
        y_max = band.get("y_max", h)
        region = np.zeros((h, w), bool)
        region[:y_max, bx0:bx1] = True
        band_hole = flat_hole & region
        if not band_hole.any():
            continue
        if band["kind"] == "sky":
            # the sky seen between two columns is the same distant sky that is
            # open to the left of them: take its colour row by row from a
            # reference strip, then blend it into the gap's own visible sky
            sub = (slice(0, y_max), slice(bx0, bx1))
            rx0, rx1 = spec["sky_ref"]
            ref = np.median(flat[:y_max, rx0:rx1], axis=1)
            ref = ndimage.gaussian_filter1d(ref, band.get("sky_soften", 3), axis=0, mode="nearest")
            guess = np.repeat(ref[:, None, :], bx1 - bx0, axis=1).astype(np.float32)
            v = known_near[sub]
            diff = np.where(v[..., None], flat[sub] - guess, 0).astype(np.float32)
            corr = harmonic_fill(diff, v, ~v, iterations=1500)
            filled = np.where(band_hole[sub][..., None], guess + corr, plate[sub])
            filled = add_grain(filled, band_hole[sub], flat[sub], v, rng)
            plate[sub] = filled
        else:
            plate = fill_column(plate, flat, known_core, band_hole, (bx0, bx1, y_max),
                                band, global_shade, donors, rng)

    fwd_x = straight.vx + (xs - straight.vx) * f
    back = remap(plate, fwd_x, ys, cv2.INTER_CUBIC)
    result = photo.copy()
    result[hole] = back[hole]
    if debug is not None:
        Image.fromarray(np.clip(flat, 0, 255).astype(np.uint8)).save(debug / "straight.png")
        Image.fromarray(np.clip(plate, 0, 255).astype(np.uint8)).save(debug / "straight-plate.png")
    return result


def add_grain(img, region, flat, sample_region, rng):
    """Match the fine grain of nearby sky so the filled sky is not flat."""
    if not sample_region.any() or not region.any():
        return img
    hp = flat - cv2.GaussianBlur(flat, (0, 0), 1.5)
    vals = hp[sample_region]
    std = np.minimum(1.4826 * np.median(np.abs(vals - np.median(vals, axis=0)), axis=0), 2.0)
    noise = rng.standard_normal(img.shape).astype(np.float32)
    noise = cv2.GaussianBlur(noise, (0, 0), 0.6)
    noise *= std / (noise.std() + 1e-6)
    out = img.copy()
    out[region] += noise[region]
    return out


def fill_column(plate, flat, known, hole, extent, band, global_shade, donors, rng):
    """Rebuild a straightened column inside `hole`.

    Column = profile(x) * shade(y) + veins(x, y). The profile (flutes, lit
    edge) holds all the way down the shaft; the shade follows the light
    falloff shared by all the columns, matched to this column where it is
    visible; the veins are borrowed from fully visible marble in tall
    blocks; finally the seam with the visible column is relaxed away."""
    x0, x1, y_max = extent
    h = flat.shape[0]
    sl = np.s_[:y_max, x0:x1]
    col = flat[sl]
    col_known = known[sl]
    col_hole = hole[sl]
    bh, bw = col_known.shape

    profile, shade_own, rows = column_model(col, col_known, 30)
    missing = np.isnan(profile).any(axis=1)
    if missing.all():
        raise ValueError(f"band {band['x']} has no visible pixels to model")
    if missing.any():
        good = np.nonzero(~missing)[0]
        for c in range(3):
            profile[missing, c] = np.interp(np.nonzero(missing)[0], good, profile[good, c])
    profile = ndimage.median_filter(profile, size=(3, 1))
    g = global_shade[:bh]
    rel = shade_own / g
    rel = ndimage.gaussian_filter1d(fill_nan_1d(rel), 25, mode="nearest")
    shade = g * rel
    base = profile[None] * shade[:, None, None]

    # veins in tall blocks with soft crossfades
    block, fade = band.get("block", 120), band.get("fade", 32)
    synth = np.zeros((bh, bw, 3), np.float32)
    weight = np.zeros((bh, 1, 1), np.float32)
    top = -fade
    while top < bh:
        rows_out = np.arange(top, top + block + fade)
        donor = donors[int(rng.integers(len(donors)))]
        dh = donor.shape[0]
        if dh <= len(rows_out):
            piece = cv2.resize(donor, (bw, len(rows_out)), interpolation=cv2.INTER_CUBIC)
        else:
            start = int(rng.integers(0, dh - len(rows_out)))
            piece = cv2.resize(donor[start:start + len(rows_out)], (bw, len(rows_out)), interpolation=cv2.INTER_AREA)
        if rng.random() < 0.5:
            piece = piece[:, ::-1]
        ramp = np.ones(len(rows_out), np.float32)
        ramp[:fade] = np.linspace(0, 1, fade + 2)[1:-1]
        ramp[-fade:] = np.linspace(1, 0, fade + 2)[1:-1]
        ok = (rows_out >= 0) & (rows_out < bh)
        synth[rows_out[ok]] += piece[ok] * ramp[ok][:, None, None]
        weight[rows_out[ok]] += ramp[ok][:, None, None]
        top += block
    synth /= np.maximum(weight, 1e-3)
    # match the strength of this column's own visible veins (a shaded column
    # shows far less than a sunlit one); fall back to the donors' strength
    own = (col - base)[col_known]
    if own.size > 400:
        def spread(v):
            return 1.4826 * np.median(np.abs(v - np.median(v, axis=0)), axis=0).mean()
        donor_spread = spread(np.concatenate([d.reshape(-1, 3) for d in donors]))
        scale = float(np.clip(spread(own) / max(donor_spread, 1e-3), 0.15, 1.2))
    else:
        scale = 1.0
    synth *= scale * band.get("vein_strength", 1.0)
    filled = base + synth

    # relax the seam: carry the visible column's difference from the model
    # smoothly into the hole
    diff = np.where(col_known[..., None], col - filled, 0).astype(np.float32)
    # smooth the difference over known pixels only (normalised convolution),
    # so single veins do not get smeared into the rebuilt marble
    wk = cv2.GaussianBlur(col_known.astype(np.float32), (0, 0), 2.5)
    diff = cv2.GaussianBlur(diff, (0, 0), 2.5) / np.maximum(wk, 1e-3)[..., None]
    diff = np.where(col_known[..., None], diff, 0)
    # solve over everything that is not trusted (the hole and the guard ring
    # around it) so the correction is pinned right up to the visible column
    correction = harmonic_fill(diff, col_known, ~col_known, iterations=1500)
    if DEBUG_DIR is not None:
        tag = f"{x0}-{x1}"
        np.save(DEBUG_DIR / f"col-{tag}-filled.npy", filled)
        np.save(DEBUG_DIR / f"col-{tag}-corr.npy", np.where(col_hole[..., None], correction, 0))
    out_col = np.where(col_hole[..., None], filled + correction, col)
    plate = plate.copy()
    plate[sl] = out_col
    return plate


# ------------------------------------------------------------- the motion

def pose(spec, t):
    """Choreography for t in [0, 1]: the eyes come level first while the
    head barely stirs; then the head bows, the neck following a little
    behind, and the eyes settle lower still."""
    m = spec["motion"]
    eyes = m["eye_level"] * ease(0.0, 0.3, t) + m["eye_down"] * ease_in_out(0.5, 1.0, t)
    stir = m["stir"] * ease(0.05, 0.32, t)
    bow = ease_in_out(0.25, 0.95, t)
    # the neck starts with the head and carries much of the turn, so the
    # throat follows the chin instead of folding under it
    lean = ease_in_out(m.get("neck_from", 0.2), 0.97, t)
    head = math.radians(stir + m["head"] * bow)
    neck = math.radians(m["neck"] * lean)
    return {"eyes": eyes, "head": head, "neck": neck}


def eye_offset(px, py, eyes, eye_field):
    """Source position for the carved iris: undo its small slide."""
    if eye_field is None or eyes == 0:
        return px, py
    dx_field, dy_field = eye_field
    ex = eyes * sample(dx_field, px, py)
    ey = eyes * sample(dy_field, px, py)
    for _ in range(4):
        nx, ny = px - ex, py - ey
        ex, ey = eyes * sample(dx_field, nx, ny), eyes * sample(dy_field, nx, ny)
    return px - ex, py - ey


def rigid_maps(spec, p, box, eye_field):
    """Exact inverse of the head's rigid turn (skull pivot, then neck pivot)."""
    x0, y0, x1, y1 = box
    qy, qx = np.mgrid[y0:y1, x0:x1].astype(np.float32)
    p1x, p1y = spec["pivot_head"]
    p2x, p2y = spec["pivot_neck"]
    px, py = rotate_about(qx, qy, p2x, p2y, -p["neck"])
    px, py = rotate_about(px, py, p1x, p1y, -p["head"])
    return eye_offset(px, py, p["eyes"], eye_field)


def bend_maps(spec, s, h_weight, p, box):
    """Inverse of the neck's smooth bend: each source pixel turns by its own
    share of the head and neck angles; solved by fixed-point iteration.
    Returns the maps and the residual error (large where it fails, e.g. where
    the bend folds the neck over itself)."""
    x0, y0, x1, y1 = box
    qy, qx = np.mgrid[y0:y1, x0:x1].astype(np.float32)
    p1x, p1y = spec["pivot_head"]
    p2x, p2y = spec["pivot_neck"]

    def forward(px, py):
        hx, hy = rotate_about(px, py, p1x, p1y, p["head"] * sample(h_weight, px, py))
        return rotate_about(hx, hy, p2x, p2y, p["neck"] * sample(s, px, py))

    px, py = qx.copy(), qy.copy()
    for _ in range(30):
        fx, fy = forward(px, py)
        px, py = px - (fx - qx), py - (fy - qy)
    fx, fy = forward(px, py)
    return px, py, np.hypot(fx - qx, fy - qy)


def eye_displacement(shape, eye):
    """A smooth bump that moves the iris (dx, dy per unit of `eyes`), zero at
    and beyond `radius` so the lids and brow never move."""
    h, w = shape
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
    cx, cy = eye["center"]
    r = np.hypot((xs - cx) / eye["radius"][0], (ys - cy) / eye["radius"][1])
    bump = np.where(r < 1, np.cos(np.clip(r, 0, 1) * math.pi / 2) ** 2, 0).astype(np.float32)
    if "lid_mask" in eye:
        lid = polygon_mask(shape, eye["lid_mask"])
        lid = cv2.GaussianBlur(lid, (0, 0), eye.get("lid_soften", 1.2))
        bump *= lid
    return bump * eye["shift"][0], bump * eye["shift"][1]


# ------------------------------------------------------------- per variant

def build(name, debug_root=None):
    spec = json.loads((SPEC_DIR / f"{name}.json").read_text())
    photo = load_rgb(ROOT / spec["image"])
    h, w, _ = photo.shape
    rng = np.random.default_rng(spec.get("seed", 7))
    global DEBUG_DIR
    debug = None
    if debug_root:
        debug = Path(debug_root) / name
        debug.mkdir(parents=True, exist_ok=True)
    DEBUG_DIR = debug

    moving = polygon_mask((h, w), spec["moving"])               # head + neck
    neck_poly = polygon_mask((h, w), spec["neck"])               # the part that bends
    tail_poly = polygon_mask((h, w), spec["tail"])               # crest behind the hair
    cloak = polygon_mask((h, w), spec["cloak"])                  # static, in front of the neck
    neck = np.minimum(moving, neck_poly)
    head = np.clip(moving - neck, 0, 1)
    tail = np.minimum(head, tail_poly)
    front = np.clip(head - tail, 0, 1)
    # where the head meets the neck (not the outer silhouette) give the head
    # a soft lower edge, so it settles over the neck instead of cutting it
    seam = ndimage.binary_dilation(neck_poly > 0.5, iterations=3) & (moving > 0.5)
    soft_front = cv2.GaussianBlur(front, (0, 0), spec.get("seam_soften", 1.6))
    front = np.where(seam, np.minimum(front, soft_front), front).astype(np.float32)

    # bend weights: 1 on the head, falling to 0 at the cloak along the neck
    head_core = head > 0.5
    base = cloak > 0.5
    # measured from the face and helmet only: hair hanging beside the crest
    # tail should bend with the neck, not ride with the tail
    d_head = ndimage.distance_transform_edt(~(front > 0.5))
    d_base = ndimage.distance_transform_edt(~base)
    s = d_base / np.maximum(d_base + d_head, 1e-3)
    s = cv2.GaussianBlur(s.astype(np.float32), (0, 0), spec.get("bend_soften", 6))
    s[head_core] = 1.0
    s[base] = 0.0
    s = np.clip(s, 0, 1).astype(np.float32)
    # the head's own turn (about the skull pivot) fades out down the neck
    h_weight = smoothstep(spec.get("head_turn_from", 0.55), 1.0, s).astype(np.float32)

    # the region the head could uncover, rebuilt once as a static plate
    reach = int(spec.get("plate_margin", 6))
    hole = ndimage.binary_dilation(moving > 0.02, iterations=reach) & ~(cloak > 0.5)
    plate = build_plate(photo, hole, spec, rng, debug)
    if debug is not None:
        Image.fromarray(np.clip(plate, 0, 255).astype(np.uint8)).save(debug / "plate.png")
        np.save(debug / "s.npy", s)

    eye_field = eye_displacement((h, w), spec["eye"]) if spec.get("eye") else None
    box = spec["work_box"]  # region that can change: x0, y0, x1, y1
    x0, y0, x1, y1 = box
    count = spec["frames"]
    frames = []
    patches = []
    photo_box = photo[y0:y1, x0:x1]
    neck_layer = np.maximum(neck, ndimage.grey_dilation(head, size=5) * (s > 0.97))
    # the original neck, used to fill any gap the motion opens in it
    neck_under = np.clip(neck - cloak, 0, 1).astype(np.float32)
    for i in range(1, count + 1):
        t = i / count
        p = pose(spec, t)
        frame = plate[y0:y1, x0:x1].copy()
        rx, ry = rigid_maps(spec, p, box, eye_field)
        bx, by, err = bend_maps(spec, s, h_weight, p, box)
        cover = np.zeros(frame.shape[:2], np.float32)  # where moved statue lands
        # layers back to front: crest tail, neck (with the hair), cloak, head
        for kind, layer_alpha in (("rigid", tail), ("bend", neck_layer), ("static", cloak), ("rigid", front)):
            if kind == "static":
                a = layer_alpha[y0:y1, x0:x1][..., None]
                frame = photo_box * a + frame * (1 - a)
                continue
            mx, my = (rx, ry) if kind == "rigid" else (bx, by)
            colour = remap(photo, mx, my)
            alpha = remap(layer_alpha.astype(np.float32), mx, my, cv2.INTER_LINEAR, outside=0)
            if kind == "bend":
                alpha = np.where(err < 0.25, alpha, 0)
            alpha = np.clip(alpha, 0, 1)[..., None]
            frame = colour * alpha + frame * (1 - alpha)
            cover = np.maximum(cover, alpha[..., 0])
        # what this frame replaces: only the eye while the head is still,
        # then the whole region the head leaves or enters, as one patch
        if p["head"] == 0 and p["neck"] == 0:
            # the head has not moved yet: the photograph with only the irises
            # slid (the rigid map is the identity everywhere else)
            frame = remap(photo, rx, ry)
            moved = np.abs(frame - photo_box).max(axis=2) > 0.5
            patch = ndimage.binary_dilation(moved, iterations=2)
        else:
            patch = hole[y0:y1, x0:x1] | ndimage.binary_dilation(cover > 0.01, iterations=2)
            patch &= ~(cloak[y0:y1, x0:x1] > 0.999) | (cover > 0.01)
        patches.append(patch)
        # wherever the moved statue leaves a gap in the neck (it pulled away or
        # the bend folded), show the neck's own marble from the photograph,
        # never the background behind it
        near = cv2.dilate((cover > 0.5).astype(np.uint8), np.ones((15, 15), np.uint8)) > 0
        gap = neck_under[y0:y1, x0:x1] * near * (1 - cover)
        gap = np.clip(gap, 0, 1)[..., None]
        frame = photo_box * gap + frame * (1 - gap)
        frames.append(frame)
        if debug is not None:
            full = photo.copy()
            full[y0:y1, x0:x1] = frame
            Image.fromarray(np.clip(full, 0, 255).astype(np.uint8)).save(debug / f"frame-{i:02d}.png")
        print(f"{name}: frame {i}/{count}  head {math.degrees(p['head']):.1f}°  neck {math.degrees(p['neck']):.1f}°  eyes {p['eyes']:.2f}", flush=True)

    # each frame is stored on its own, cropped to the pixels that differ from
    # the photograph (with a soft edge); nothing else is drawn over the photo
    out_dir = OUT_DIR / "statue"
    out_dir.mkdir(parents=True, exist_ok=True)
    for old in out_dir.glob(f"{name}-*.webp"):
        old.unlink()
    boxes = []
    total = 0
    for i, (frame, patch) in enumerate(zip(frames, patches), start=1):
        # soft edge outside the patch, where the frame equals the photo anyway
        grown = ndimage.binary_dilation(patch, iterations=2)
        alpha = cv2.GaussianBlur(grown.astype(np.float32), (0, 0), 1.2)
        alpha = np.maximum(alpha, patch)
        alpha[alpha < 2 / 255] = 0
        ys, xs = np.nonzero(alpha > 0)
        fx0, fx1, fy0, fy1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        rgba = np.dstack([np.clip(frame, 0, 255), np.clip(alpha * 255, 0, 255)])[fy0:fy1, fx0:fx1]
        path = out_dir / f"{name}-{i:02d}.webp"
        Image.fromarray(rgba.round().astype(np.uint8), "RGBA").save(
            path, "WEBP", quality=spec.get("quality", 88), method=6, alpha_quality=100)
        total += path.stat().st_size
        boxes.append([int(x0 + fx0), int(y0 + fy0), int(fx1 - fx0), int(fy1 - fy0)])
    print(f"{name}: wrote {count} frames to {out_dir.relative_to(ROOT)} ({total // 1024} KB)")
    return {"width": w, "height": h, "boxes": boxes}


def write_module(metas):
    lines = [
        "// Generated by tools/build-statue-turn.py. Do not edit by hand.",
        "// Each frame: [x, y, width, height] of its patch on the photograph.",
    ]
    for name, meta in metas.items():
        for i in range(1, len(meta["boxes"]) + 1):
            lines.append(f'import {name}{i:02d} from "./statue/{name}-{i:02d}.webp";')
    lines.append("")
    lines.append("export const STATUE_FRAMES = {")
    for name, meta in metas.items():
        lines.append(f"  {name}: {{")
        lines.append(f"    width: {meta['width']},")
        lines.append(f"    height: {meta['height']},")
        lines.append("    frames: [")
        for i, box in enumerate(meta["boxes"], start=1):
            lines.append(f"      {{ src: {name}{i:02d}, box: {json.dumps(box)} }},")
        lines.append("    ],")
        lines.append("  },")
    lines.append("};")
    (OUT_DIR / "statue-frames.js").write_text("\n".join(lines) + "\n")
    (SPEC_DIR / "built.json").write_text(json.dumps(metas, indent=1) + "\n")


if __name__ == "__main__":
    args = sys.argv[1:]
    debug_root = None
    if "--debug" in args:
        i = args.index("--debug")
        debug_root = args[i + 1]
        del args[i:i + 2]
    names = args or ["desktop", "mobile"]
    # keep the variants that are not rebuilt this time
    built = SPEC_DIR / "built.json"
    metas = json.loads(built.read_text()) if built.exists() else {}
    for name in names:
        metas[name] = build(name, debug_root)
    write_module({k: metas[k] for k in ("desktop", "mobile") if k in metas})
