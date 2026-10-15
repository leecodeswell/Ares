// Additions to the colonnade shader (scene.js), applied by colonnade():
//  - five statues stand in the column gaps on the walled side, each holding
//    out an unrolled scroll; the visitor clicks a scroll to read its passage.
//    The figure is a 3D scan of the Portrait Statue of Aule Metele (the
//    Arringatore, Museo Archeologico Nazionale, Florence) from Three D Scans,
//    baked into a signed-distance atlas by tools/build-journey-statue.py;
//  - the barrel vault is smooth, without coffers;
//  - the final grade is matched to the hero photograph's marble.
import AULE from "./aule-sdf.json";

export const STATUE_COUNT = 4;
export const STATUE_X = 2.45; // at the front of the column line, so phones see them too
const SCALE = 1.15, YAW = 1.05; // turned toward the approaching visitor
// one every other bay, starting a bay in from the entrance
export const statueZ = (i) => 2.3 + 9.2 * (i + 1);
// the scroll's centre, in scene coordinates (before the display mirror)
export const scrollPoint = (i) => {
  const lx = -0.37 * SCALE, ly = 2.3 * SCALE, lz = -0.225 * SCALE;
  return [STATUE_X + lx * Math.cos(YAW) - lz * Math.sin(YAW), ly, statueZ(i) + lx * Math.sin(YAW) + lz * Math.cos(YAW)];
};

const FUNCS = `

float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
  vec3 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}
// capsule whose radius tapers from ra (at a) to rb (at b)
float sdTaper(vec3 p, vec3 a, vec3 b, float ra, float rb) {
  vec3 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - mix(ra, rb, h);
}
float sdCylX(vec3 p, float r, float h) {
  vec2 d = abs(vec2(length(p.yz), p.x)) - vec2(r, h);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}
float sdCylZ(vec3 p, float r, float h) {
  vec2 d = abs(vec2(length(p.xy), p.z)) - vec2(r, h);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}
float sdEll(vec3 p, vec3 r) {
  float k0 = length(p / r), k1 = length(p / (r * r));
  return k0 * (k0 - 1.0) / k1;
}
float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}
float smax(float a, float b, float k) { return -smin(-a, -b, k); }
float statueIndex(float z) { return clamp(floor((z - 2.3) / 9.2 + 0.5), 1.0, 4.0); }

// A nub head with the original ring crest: the first design's head and dome
// blended into one smooth shape, with no brim and no neck.
float helmetHead(vec3 head) {
  // one egg shape: as broad as the old dome at the crown, tapering to the shoulders
  float t = clamp((head.y + 0.14) / 0.32, 0.0, 1.0);
  vec3 r = vec3(mix(0.115, 0.15, smoothstep(0.0, 0.6, t)), 0.16, mix(0.105, 0.14, smoothstep(0.0, 0.6, t)));
  float nub = sdEll(head - vec3(0.0, 0.02, 0.0), r);
  vec2 ch = head.xy - vec2(0.03, 0.04);
  float crest = max(max(abs(length(ch * vec2(1.0, 0.85)) - 0.2) - 0.05, abs(head.z) - 0.025), -(ch.y + 0.02 + 0.3 * ch.x));
  return smin(nub, crest, 0.015);
}

// A forearm and a hand closed around the scroll's top roller.
float gripHand(vec3 s, float side) {
  vec3 w = vec3(-0.6, 1.995, 0.285 * side);                 // wrist
  float d = sdEll(s - (w + vec3(-0.035, 0.012, 0.0)), vec3(0.04, 0.02, 0.034));
  for (int k = 0; k < 4; k++) {
    float z = 0.285 * side + (float(k) - 1.5) * 0.017;
    vec3 base = vec3(-0.655, 2.05, z), tip = vec3(-0.693, 2.0, z);
    d = smin(d, sdTaper(s, vec3(-0.635, 2.035, z), base, 0.0095, 0.0085), 0.006);
    d = smin(d, sdTaper(s, base, tip, 0.0085, 0.0072), 0.004);
  }
  d = smin(d, sdTaper(s, w + vec3(-0.03, -0.01, -0.03 * side), vec3(-0.672, 1.985, 0.25 * side), 0.012, 0.009), 0.008); // thumb
  return d;
}

uniform sampler2D uAule;
// The scan's signed distance, from a z-sliced atlas: two bilinear taps blended across z.
float aulePlane(vec2 xy, float k) {
  float r = floor(k / ${AULE.cols.toFixed(1)}), c = k - r * ${AULE.cols.toFixed(1)};
  vec2 px = vec2(c * ${AULE.dims[0].toFixed(1)} + xy.x, r * ${AULE.dims[1].toFixed(1)} + ${AULE.dims[1].toFixed(1)} - xy.y);
  return texture2D(uAule, px / vec2(${AULE.atlas[0].toFixed(1)}, ${AULE.atlas[1].toFixed(1)})).r;
}
float aule(vec3 s) {
  const vec3 LO = vec3(${AULE.lo.map((v) => v.toFixed(5)).join(", ")});
  const vec3 DIMS = vec3(${AULE.dims.map((v) => v.toFixed(1)).join(", ")});
  vec3 g = (s - LO) / ${AULE.vox.toFixed(4)} - 0.5;
  vec3 cl = clamp(g, vec3(0.5), DIMS - 1.5);
  float outside = length(g - cl) * ${AULE.vox.toFixed(4)};
  float k0 = floor(cl.z), f = cl.z - k0;
  vec2 xy = cl.xy + 0.5;
  float v = mix(aulePlane(xy, k0), aulePlane(xy, k0 + 1.0), f);
  return ((v - 0.5) * 2.0 * ${AULE.band.toFixed(3)} + outside) * 0.9;
}

// x: distance, y: 5 statue, 6 scroll
vec2 statue(vec3 p) {
  float idx = statueIndex(p.z);
  vec3 w0 = vec3(p.x - ${STATUE_X.toFixed(2)}, p.y, p.z - (2.3 + 9.2 * idx));
  float cy = cos(${YAW}), sy = sin(${YAW});
  vec3 s = vec3(w0.x * cy + w0.z * sy, w0.y, -w0.x * sy + w0.z * cy) / ${SCALE.toFixed(2)};
  float bound = sdBox(s - vec3(-0.1, 1.38, -0.2), vec3(0.5, 1.4, 0.68)) * ${SCALE.toFixed(2)};
  if (bound > 0.3) return vec2(bound, 5.0);

  // pedestal: die, moulded cap and foot, and a low plinth under the feet
  float ped = sdBox(s - vec3(0.0, 0.42, 0.0), vec3(0.36, 0.42, 0.36));
  ped = min(ped, sdRoundBox(s - vec3(0.0, 0.87, 0.0), vec3(0.42, 0.04, 0.42), 0.015));
  ped = min(ped, sdRoundBox(s - vec3(0.0, 0.8, 0.0), vec3(0.39, 0.03, 0.39), 0.02));
  ped = min(ped, sdRoundBox(s - vec3(0.0, 0.05, 0.0), vec3(0.44, 0.05, 0.44), 0.02));
  ped = min(ped, sdRoundBox(s - vec3(-0.02, 0.93, 0.0), vec3(0.32, 0.025, 0.33), 0.01));

  // ---- the figure: the Aule Metele scan, baked to a distance grid (bake.py)
  float d = aule(s);
  // his raised right hand is replaced by a plain, rounded fist that holds the scroll
  vec3 hp = s - vec3(-0.4, 2.58, -0.455);
  d = smax(d, -(length(hp * vec3(1.0, 0.85, 1.0)) - 0.105), 0.01);
  d = smin(d, sdEll(s - vec3(-0.37, 2.53, -0.455), vec3(0.034, 0.04, 0.033)), 0.02);

  vec2 res = vec2(min(ped, d), 5.0);
  // the scroll, held up in front of him by the end on his right: the top
  // roller runs from the fist across his chest and the sheet hangs from it
  vec3 r = s - vec3(-0.37, 0.0, -0.255);
  float top = sdCylZ(r - vec3(0.0, 2.53, 0.0), 0.021, 0.2);
  float bot = sdCylZ(r - vec3(0.0, 2.08, 0.0), 0.024, 0.2);
  vec3 kn = vec3(r.x, r.y, abs(r.z) - 0.214);
  float knobs = min(length(kn - vec3(0.0, 2.53, 0.0)) - 0.023, length(kn - vec3(0.0, 2.08, 0.0)) - 0.026);
  float bow = 0.016 * sin((r.y - 2.08) / 0.45 * PI);
  float sheet = sdBox(r - vec3(-bow, 2.305, 0.03), vec3(0.004, 0.225, 0.15));
  float scroll = min(min(top, bot), min(sheet, knobs));
  if (scroll < res.x) res = vec2(scroll, 6.0);
  res.x *= ${SCALE.toFixed(2)};
  return res;
}
`;

// Fitted by comparing the original render with the hero photograph: maps the original render's marble onto the hero
// photograph's (CIELAB a* 2.7 -> 3.6, b* 17.3 -> 10.2), keeping its lightness.
const GRADE_MATRIX = `
  col = mat3(0.99074, 0.00664, 0.11958,
             -0.28604, 0.85262, 0.16872,
             0.14507, -0.00519, 0.56437) * col + vec3(0.10197, 0.09162, 0.08673);`;

const EDITS = [
  ["vec2 map(vec3 p) {", FUNCS + "\nvec2 map(vec3 p) {"],
  ["  float ceiling = vault(p);", "  vec2 st = statue(p);\n  if (st.x < res.x) res = st;\n  float ceiling = vault(p);"],
  // a smooth vault: no coffers or rosettes, and no per-coffer tints
  ["  if (flutes > 0.5) {\n    float theta = atan(v.y, v.x);", "  if (false) {\n    float theta = atan(v.y, v.x);"],
  ["  float tint = 0.93 + 0.1 * hash12(cell + 11.7);", "  float tint = 0.98;"],
  // statues and scrolls
  ["  const float TILE = 2.4; // metres per repeat of the marble texture\n",
   `  const float TILE = 2.4; // metres per repeat of the marble texture
  if (m > 5.5) return vec3(0.9, 0.85, 0.74); // parchment
  if (m > 4.5) {
    vec3 w = pow(abs(n), vec3(4.0)); w /= w.x + w.y + w.z;
    vec3 c = marbleTexture(p.zy / 0.9 + 3.1) * w.x + marbleTexture(p.xz / 0.9 + 1.3) * w.y + marbleTexture(p.xy / 0.9 + 0.7) * w.z;
    return mix(c, vec3(0.8, 0.75, 0.68), 0.4); // statuary marble: finer, quieter veining
  }
`],
  // veins read as cool grey in the hero's marble, not brown
  ["vec3 marbleTexture(vec2 uv) { return toLinear(texture2D(uMarble, uv).rgb); }",
   `vec3 marbleTexture(vec2 uv) {
  vec3 c = toLinear(texture2D(uMarble, uv).rgb);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float vein = smoothstep(0.62, 0.3, l);
  return mix(c, vec3(l) * vec3(1.02, 1.0, 0.99), vein * 0.6);
}`],
  ["  float r = length(uv);", GRADE_MATRIX + "\n  float r = length(uv);"],
];

export function colonnade(fragment) {
  let out = fragment;
  for (const [a, b] of EDITS) {
    if (!out.includes(a)) throw new Error("shader edit missed: " + a.slice(0, 60));
    out = out.replace(a, b);
  }
  return out;
}
