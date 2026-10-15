"""Bake the journey's statue into the distance atlas the colonnade shader reads.

    pip install trimesh scipy rtree pillow
    python3 tools/build-journey-statue.py

Downloads the 3D scan of the Portrait Statue of Aule Metele (the Arringatore,
Museo Archeologico Nazionale, Florence) from Three D Scans
(https://threedscans.com/museo-archeologico-nazionale/aule/), stands it up in
the statue's local frame (faces -x, up +y, the figure's right toward -z, feet
on the pedestal at y = FEET, about 2 m tall once the shader scales it) and
samples its signed distance on a 5 mm grid. Writes src/journey/aule-sdf.png
(8-bit, distance in [-BAND, BAND] mapped to 0..255, one x-y slice per z,
tiled) and src/journey/aule-sdf.json (the grid's placement), read by
src/journey/statues.js. Takes about ten minutes.
"""
import io, json, pathlib, urllib.request, zipfile
import numpy as np, trimesh
from scipy.spatial import cKDTree
from scipy import ndimage
from PIL import Image

URL = "https://threedscans.com/wp-content/uploads/2015/11/Portrait_Statue_Of_-Aule_Meteli.obj.zip"
OUT = pathlib.Path(__file__).resolve().parent.parent / "src" / "journey"
K, FEET, VOX, BAND = 0.955, 0.955, 0.005, 0.04

archive = zipfile.ZipFile(io.BytesIO(urllib.request.urlopen(URL).read()))
name = next(n for n in archive.namelist() if n.endswith(".obj") and "MACOSX" not in n)
m = trimesh.load(io.BytesIO(archive.read(name)), file_type="obj", force="mesh")
v = m.vertices * 0.001          # millimetres to metres
v[:, 1:] *= -1                  # the scan lies upside down: turn it 180 degrees about x
axis = np.array([-0.085, 0.43]); zmin = v[:, 2].min()   # the figure's vertical axis, measured from the scan
local = np.stack([(v[:, 1] - axis[1]) * K, (v[:, 2] - zmin) * K + FEET, (v[:, 0] - axis[0]) * K], 1)
m = trimesh.Trimesh(local, m.faces, process=False)
lo = m.bounds[0] - 0.03; hi = m.bounds[1] + 0.03
dims = np.ceil((hi - lo) / VOX).astype(int); print('grid', dims, dims.prod())
pts, fid = trimesh.sample.sample_surface(m, 6_000_000, seed=1)
nrm = m.face_normals[fid]
tree = cKDTree(pts)
gx, gy, gz = [lo[i] + (np.arange(dims[i]) + 0.5) * VOX for i in range(3)]
G = np.stack(np.meshgrid(gx, gy, gz, indexing='ij'), -1).reshape(-1, 3)
# sign from the nearest few surface samples' normals (robust on open scans)
d, idx = tree.query(G, k=4, distance_upper_bound=BAND * 1.5, workers=-1)
ok = np.isfinite(d[:, 0])
sgn = np.ones(len(G))
gi = np.where(ok)[0]
ii = np.where(np.isfinite(d[gi]), idx[gi], idx[gi, :1])
side = np.einsum('nkj,nkj->nk', G[gi, None, :] - pts[ii], nrm[ii]).sum(1)
sgn[gi] = np.where(side < 0, -1.0, 1.0)
dd = np.where(ok, d[:, 0], BAND * 1.5)
# far voxels: inside if enclosed per a coarse fill of the near-surface signs
sd = np.clip(dd * sgn, -BAND, BAND).reshape(dims)
far = ~ok.reshape(dims)
neg = ndimage.binary_fill_holes(sd < 0)
sd[far & neg] = -BAND
print('negative fraction', (sd < 0).mean().round(4))
# atlas: one x-y slice per z, tiled in columns
nx, ny, nz = dims; cols = int(np.floor(4096 / nx)); rows = int(np.ceil(nz / cols))
atlas = np.full((rows * ny, cols * nx), 255, np.uint8)
q = np.round((sd / BAND * 0.5 + 0.5) * 255).astype(np.uint8)
for k in range(nz):
    r, c = divmod(k, cols)
    atlas[r * ny:(r + 1) * ny, c * nx:(c + 1) * nx] = q[:, ::-1, k].T  # rows top-down = y descending
Image.fromarray(atlas).save(OUT / 'aule-sdf.png', optimize=True)
json.dump({'lo': [float(x) for x in lo], 'dims': [int(x) for x in dims], 'vox': VOX, 'band': BAND, 'cols': int(cols), 'rows': int(rows),
           'atlas': [int(cols * nx), int(rows * ny)]}, open(OUT / 'aule-sdf.json', 'w'))
print(json.load(open(OUT / 'aule-sdf.json')))
