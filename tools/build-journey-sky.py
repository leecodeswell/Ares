"""Build the journey's sky from the site's colonnade photograph.

src/journey/sky.webp is the photograph's open sky, extended to a full frame:
the real sky is kept, what the columns hid is filled from surrounding cloud,
and the right half mirrors the left. The 3D scene wraps it around the
colonnade (src/journey/scene.js).
"""
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFilter
from scipy.ndimage import gaussian_filter

SRC = "public/images/ares-sanctuary.webp"  # run from the repository root
im = Image.open(SRC).convert("RGB")
W, H = im.size
a = np.asarray(im).astype(np.float32)
ys = np.arange(H)[:, None]
xs = np.arange(W)[None, :]

# ---- sky mask (1 = sky): open sky left of the front column + the far arch opening
m = Image.new("L", (W, H), 0)
d = ImageDraw.Draw(m)
d.polygon([(0, 0), (822, 0), (822, 560), (806, 572), (790, 592), (788, 645),
           (742, 646), (742, 667), (586, 667), (586, 724), (560, 727), (0, 775)], fill=255)
cx, cy, r = 1253.5, 362, 52.5
d.rectangle([1201, cy, 1306, 615], fill=255)
d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=255)
sky = np.asarray(m.filter(ImageFilter.GaussianBlur(0.8))).astype(np.float32) / 255

# ---- sky plate
EDGE = 812
left = a[:, :EDGE].copy()

# 1. fill what hides behind the column base (above the parapet line)
hole = ((sky[:, :EDGE] < 0.5) & (ys <= 640)).astype(np.uint8) * 255
hole = cv2.dilate(hole, np.ones((11, 11), np.uint8))
left = cv2.inpaint(left.astype(np.uint8)[..., ::-1].copy(), hole, 20,
                   cv2.INPAINT_TELEA)[..., ::-1].astype(np.float32)

# 2. behind the parapet and below row 700 the cloud sea continues, reflected and hazed, from the
#    mountain-free columns 0-560
tile_cols = np.array([x % 1120 if x % 1120 <= 560 else 1120 - x % 1120 for x in range(EDGE)])
rows = np.array([y if y <= 700 else max(1400 - y, 540) for y in range(H)])
low = a[rows][:, tile_cols]
ramp = np.clip((np.arange(H) - 700) / 190, 0, 1)[:, None, None]
haze = np.array([238, 233, 228], np.float32)
soft = np.stack([gaussian_filter(low[..., k], (8, 14)) for k in range(3)], 2)
low = low * (1 - ramp) + (soft * 0.35 + haze * 0.65) * ramp
inside = cv2.erode((sky[:, :EDGE] > 0.5).astype(np.uint8), np.ones((9, 9), np.uint8))
real = gaussian_filter(inside.astype(np.float32), 2)[..., None]
fill = (ys > 700) | ((ys > 640) & (xs[:, :EDGE] >= 560))
left = np.where(fill[..., None], a[:, :EDGE] * real + low * (1 - real), left)

# 3. mirror across x=812: continuous by construction
plate = np.concatenate([left, left[:, ::-1], left[:, : W - 2 * EDGE]], 1)

# 4. the mirrored mountain is cloned over with open cloud, faded in to the right
mask = np.zeros((H, W), np.float32)
mask[470:700, :] = 1
mask = gaussian_filter(mask, (16, 0))
mask *= np.clip((xs - EDGE) / 40, 0, 1) * np.clip((1060 - xs) / 40, 0, 1)
shifted = np.roll(plate, 700, axis=1)          # plate[:, x-700]
plate = plate * (1 - mask[..., None]) + shifted * mask[..., None]

Image.fromarray(plate.clip(0, 255).astype(np.uint8)).save("src/journey/sky.webp", "WEBP", quality=84, method=6)
