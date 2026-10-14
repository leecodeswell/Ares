"""Generate the journey's marble texture (src/journey/marble.webp).

Seamless 1024 x 1024 tile. Colours are measured from the hero statue's
marble: warm cream stone with an aged ochre patina, soft clouding, and thin,
branching umber veins. Veins come from ridged,
domain-warped noise, which branches and wanders like real marble.
Run from the repository root (Python with NumPy, SciPy and Pillow).
"""
import numpy as np
from PIL import Image
from scipy.ndimage import map_coordinates

N = 1024
rng = np.random.default_rng(11)
k = np.fft.fftfreq(N) * N
KX, KY = np.meshgrid(k, k)
K = np.sqrt(KX**2 + KY**2) + 1e-6


def band(lo, hi, slope=1.0, angle=None, stretch=1.0):
    """Periodic noise with energy between lo and hi cycles per tile.
    With an angle, features stretch along that direction (long veins)."""
    spectrum = np.fft.fft2(rng.standard_normal((N, N)))
    if angle is None:
        radial = K
        weight = 1.0
    else:
        along = KX * np.cos(angle) + KY * np.sin(angle)
        across = -KX * np.sin(angle) + KY * np.cos(angle)
        radial = np.sqrt(across**2 + (along * stretch) ** 2) + 1e-6
        weight = 1.0
    sigma = np.log(hi / lo) / 2
    weight = weight * np.exp(-((np.log(radial) - np.log((lo + hi) / 2)) ** 2) / (2 * sigma**2)) / radial**slope
    field = np.real(np.fft.ifft2(spectrum * weight))
    return (field - field.mean()) / field.std()


def warp(field, dx, dy, amount):
    yy, xx = np.mgrid[0:N, 0:N].astype(np.float32)
    return map_coordinates(field, [yy + dy * amount, xx + dx * amount], order=1, mode="wrap")


def turbulence(field):
    """Two octaves of domain warp: broad drift, then a fine crackle."""
    field = warp(field, band(1.5, 4), band(1.5, 4), 42)
    return warp(field, band(10, 24), band(10, 24), 5)


DIAGONAL = 0.62  # veins run on a gentle diagonal, as on the column's base block

# long main veins, a few soft grey drifts, and fine crackle veins
main = turbulence(band(2.5, 5, angle=DIAGONAL, stretch=6.0))
ridge = 1 - np.abs(main) / 2.4
main_v = np.clip((ridge - 0.935) / 0.065, 0, 1) ** 1.6
drift = np.clip((ridge - 0.7) / 0.3, 0, 1) ** 3 * 0.35
fine = turbulence(band(6, 14, angle=DIAGONAL + 0.5, stretch=3.0))
fine_v = np.clip(((1 - np.abs(fine) / 2.4) - 0.915) / 0.085, 0, 1) ** 2
cluster = np.clip(band(1, 3) * 0.55 + 0.5, 0, 1)            # veins gather in drifts
veins = np.clip(main_v * (0.35 + 0.8 * cluster) + drift * cluster + fine_v * 0.75 * (0.4 + 0.6 * cluster), 0, 1)

# soft clouding in the stone itself
cloud = band(2, 10, 0.4) * 0.6 + band(10, 40, 0.2) * 0.15

stone = np.array([236, 221, 199], np.float32)   # warm cream, from the statue's lit marble
shade = np.array([214, 194, 168], np.float32)   # deeper ochre clouding
vein = np.array([118, 92, 66], np.float32)      # umber veins, from the statue's darkest veining
patina = np.array([206, 182, 146], np.float32)  # aged yellow-brown mottling

# aged patina: soft yellow-brown mottling, heavier in drifts, plus fine speckle
mottle = np.clip(band(6, 30, 0.3) * 0.5 + band(1.5, 4) * 0.35 + 0.1, 0, 1.4)
speckle = np.clip(band(80, 200, 0.0) * 0.5, -1, 1)

img = stone[None, None] * (1 - 0.035 * np.clip(cloud, 0, 2)[..., None])
img = img * (1 - 0.35 * np.clip(-cloud, 0, 1.5)[..., None]) + shade * 0.35 * np.clip(-cloud, 0, 1.5)[..., None]
img = img * (1 - 0.28 * mottle[..., None]) + patina * 0.28 * mottle[..., None]
img = img * (1 + 0.025 * speckle[..., None])
img = img * (1 - veins[..., None] * 0.78) + vein * veins[..., None] * 0.78
Image.fromarray(img.clip(0, 255).astype(np.uint8)).save("src/journey/marble.webp", "WEBP", quality=88, method=6)
