// A static marble colonnade, described as exact shapes (signed distance
// functions) and rendered by ray marching. The building never moves; only the
// camera does. Units are metres: the corridor runs along +z, the floor is y = 0.

export const SCENE = {
  spacing: 3.2, // between columns along the corridor
  columns: 14, // per side
  rowX: 3.0, // column rows at x = ±3
  endZ: 42.0, // face of the far wall with the arch
};

export const VERTEX = `
attribute vec2 aPosition;
void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }
`;

export const FRAGMENT = `
precision highp float;

uniform vec2 uResolution;
uniform vec3 uCamera;
uniform vec3 uTarget;
uniform float uFov;          // vertical field of view, radians
uniform sampler2D uSky;
uniform float uReflections;  // 0 or 1
uniform float uGlow;
uniform vec3 uPaper;
uniform float uPaperAmount;

#define SPACING 3.2
#define LASTCOL 13.0
#define ROWX 3.0
#define COLR 0.42
#define COLH 7.0
#define CEIL 8.4
#define ENDZ 42.0

const vec3 SUN = normalize(vec3(-0.86, 0.42, -0.2));   // toward the sun: low, from the left
const vec3 SUN_COLOR = vec3(1.0, 0.83, 0.64);
const vec3 HAZE = vec3(0.93, 0.9, 0.88);

// ---------- helpers
float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}
float sdTorusY(vec3 p, float R, float r) {
  vec2 q = vec2(length(p.xz) - R, p.y);
  return length(q) - r;
}
float hash(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.x + p.y) * p.z);
}
float noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x),
                 mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x),
                 mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm(vec3 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}

// ---------- the building
float flutes = 1.0;

// One column in its own cell: plinth, two base mouldings, fluted tapering
// shaft, capital (echinus + abacus).
float column(vec3 q) {
  float bound = sdBox(q - vec3(0.0, CEIL * 0.5, 0.0), vec3(0.75, CEIL * 0.5, 0.75));
  // the quick box bound speeds up camera rays; shadows need the exact, continuous distance
  if (flutes > 0.5 && bound > 0.5) return bound;
  float plinth = sdBox(q - vec3(0.0, 0.2, 0.0), vec3(0.64, 0.2, 0.64));
  float torus1 = sdTorusY(q - vec3(0.0, 0.5, 0.0), COLR + 0.08, 0.11);
  float torus2 = sdTorusY(q - vec3(0.0, 0.72, 0.0), COLR + 0.03, 0.07);
  float taper = COLR * (1.0 - 0.07 * clamp(q.y / COLH, 0.0, 1.0));
  float angle = atan(q.z, q.x);
  float flute = flutes * 0.022 * smoothstep(0.35, 1.0, abs(sin(angle * 10.0)));
  float shaft = max(length(q.xz) - (taper - flute), abs(q.y - COLH * 0.5) - COLH * 0.5);
  float echinus = sdTorusY(q - vec3(0.0, COLH - 0.32, 0.0), COLR + 0.04, 0.13);
  float neck = max(length(q.xz) - (COLR + 0.1) + (q.y - (COLH - 0.5)) * 0.5, abs(q.y - (COLH - 0.25)) - 0.25);
  float abacus = sdBox(q - vec3(0.0, COLH - 0.06, 0.0), vec3(0.66, 0.11, 0.66));
  return min(min(min(plinth, torus1), min(torus2, shaft)), min(min(echinus, neck), abacus));
}

vec2 map(vec3 p) {
  // column rows on both sides, repeated along z
  vec3 q = p;
  q.x = abs(q.x) - ROWX;
  q.z = p.z - SPACING * clamp(floor(p.z / SPACING + 0.5), 0.0, LASTCOL);
  float d = column(q);
  float m = 1.0;

  // entablature over each row
  float beam = sdBox(vec3(abs(p.x) - ROWX, p.y - (COLH + 0.42), p.z - 20.7), vec3(0.62, 0.42, 21.3));
  float cornice = sdBox(vec3(abs(p.x) - ROWX, p.y - (COLH + 0.95), p.z - 20.7), vec3(0.78, 0.12, 21.45));
  d = min(d, min(beam, cornice));

  // coffered ceiling between the rows
  float slab = sdBox(p - vec3(0.0, CEIL + 0.35, 20.7), vec3(3.62, 0.3, 21.45));
  vec2 cell = vec2(p.x, p.z) - vec2(1.25, 1.6) * floor((vec2(p.x, p.z) + vec2(0.625, 0.8)) / vec2(1.25, 1.6)) ;
  float coffer = sdBox(vec3(cell.x, p.y - (CEIL + 0.05), cell.y), vec3(0.42, 0.25, 0.58));
  coffer = max(coffer, sdBox(p - vec3(0.0, CEIL, 20.7), vec3(2.5, 1.0, 20.6)));
  slab = max(slab, -coffer);
  d = min(d, slab);

  // corridor floor, steps and the lower terrace
  float floorSlab = sdBox(p - vec3(0.0, -1.5, 21.0), vec3(4.4, 1.5, 22.2));
  float step1 = sdBox(p - vec3(0.0, -0.1, -1.55), vec3(3.9, 0.1, 0.55));
  float step2 = sdBox(p - vec3(0.0, -0.3, -2.1), vec3(3.9, 0.1, 0.55));
  float step3 = sdBox(p - vec3(0.0, -0.5, -2.65), vec3(3.9, 0.1, 0.55));
  float terrace = sdBox(p - vec3(0.0, -1.6, -14.0), vec3(13.0, 1.0, 11.0));
  float steps = min(step1, min(step2, step3));
  float ground = min(floorSlab, min(steps, terrace));
  // a low parapet along the terrace's left edge
  float parapet = sdBox(vec3(abs(p.x) - 12.6, p.y + 0.15, p.z + 14.0), vec3(0.3, 0.45, 10.8));
  ground = min(ground, parapet);
  if (ground < d) { d = ground; m = 2.0; }

  // far wall with an arched opening
  float endWall = sdBox(p - vec3(0.0, CEIL * 0.5, ENDZ + 0.4), vec3(3.75, CEIL * 0.5 + 0.65, 0.4));
  float opening = min(sdBox(p - vec3(0.0, 2.1, ENDZ + 0.4), vec3(1.3, 2.1, 1.0)),
                      max(length(p.xy - vec2(0.0, 4.2)) - 1.3, abs(p.z - (ENDZ + 0.4)) - 1.0));
  endWall = max(endWall, -opening);
  float archMould = max(abs(length(p.xy - vec2(0.0, 4.2)) - 1.42) - 0.12, abs(p.z - ENDZ + 0.05) - 0.08);
  archMould = max(archMould, -(p.y - 4.2));
  float jambs = sdBox(vec3(abs(p.x) - 1.42, p.y - 2.1, p.z - ENDZ + 0.05), vec3(0.12, 2.1, 0.08));
  endWall = min(endWall, min(archMould, jambs));
  d = min(d, endWall);
  return vec2(d, m);
}

vec3 normalAt(vec3 p) {
  vec2 e = vec2(0.0015, 0.0);
  return normalize(vec3(
    map(p + e.xyy).x - map(p - e.xyy).x,
    map(p + e.yxy).x - map(p - e.yxy).x,
    map(p + e.yyx).x - map(p - e.yyx).x));
}

vec2 march(vec3 ro, vec3 rd, float far, int steps) {
  float t = 0.02;
  for (int i = 0; i < 120; i++) {
    if (i >= steps) break;
    vec2 h = map(ro + rd * t);
    if (h.x < 0.0008 * t) return vec2(t, h.y);
    t += h.x * 0.9;
    if (t > far) break;
  }
  return vec2(-1.0, 0.0);
}

float softShadow(vec3 ro, vec3 rd) {
  flutes = 0.0; // shadows and occlusion don't need the flutes, which only add noise
  float res = 1.0, t = 0.06;
  for (int i = 0; i < 36; i++) {
    float h = map(ro + rd * t).x;
    res = min(res, 8.0 * h / t);
    t += clamp(h, 0.04, 0.6);
    if (res < 0.01 || t > 30.0) break;
  }
  flutes = 1.0;
  res = clamp(res, 0.0, 1.0);
  return res * res * (3.0 - 2.0 * res);
}

float occlusion(vec3 p, vec3 n) {
  flutes = 0.0;
  float occ = 0.0, w = 1.0;
  for (int i = 1; i <= 5; i++) {
    float h = 0.06 * float(i) * float(i);
    occ += w * (h - map(p + n * h).x);
    w *= 0.6;
  }
  flutes = 1.0;
  return clamp(1.0 - 1.6 * occ, 0.0, 1.0);
}

vec3 toLinear(vec3 c) { return pow(c, vec3(2.2)); }

// The site's sky photograph wrapped around the scene by direction.
vec3 skyColor(vec3 rd) {
  float az = atan(rd.x, rd.z);
  float el = asin(clamp(rd.y, -1.0, 1.0));
  vec2 uv = vec2(0.36 + az / 2.2, 0.53 - el / 1.05);
  uv = 1.0 - abs(1.0 - mod(uv, 2.0));
  vec3 c = toLinear(texture2D(uSky, uv).rgb);
  // warm brightening toward the sun
  float sun = pow(max(dot(rd, SUN), 0.0), 5.0);
  return c * 1.05 + vec3(0.42, 0.3, 0.18) * sun;
}

vec3 marble(vec3 p, float isFloor) {
  float veins = fbm(p * 0.9 + vec3(3.1, 0.0, 1.7));
  // soft clouding with a few long grey veins, as in the photographs
  float warp = fbm(p * 0.7 + vec3(3.1, 0.0, 1.7));
  float vein = abs(sin((p.x * 0.5 + p.y * 0.35 + p.z * 0.25) * 0.7 + warp * 5.0));
  float line = (1.0 - smoothstep(0.0, 0.04, vein)) * smoothstep(0.52, 0.78, fbm(p * 0.35 + 7.0));
  vec3 base = vec3(0.93, 0.89, 0.83);
  base *= 0.94 + 0.08 * fbm(p * 1.6);
  base = mix(base, vec3(0.62, 0.58, 0.54), line * 0.2);
  if (isFloor > 0.5) {
    // large polished tiles with fine joints
    vec2 g = abs(fract(p.xz / vec2(1.6, 1.6)) - 0.5);
    float joint = smoothstep(0.492, 0.5, max(g.x, g.y));
    base = mix(base, base * 0.82, joint);
  }
  return base;
}

vec3 shade(vec3 p, vec3 rd, vec3 n, float m, bool full) {
  vec3 albedo = marble(p, m > 1.5 ? 1.0 : 0.0);
  float diff = max(dot(n, SUN), 0.0);
  float shadow = full ? softShadow(p + n * 0.03, SUN) : 1.0;
  float ao = full ? occlusion(p, n) : 1.0;
  float skyLight = 0.55 + 0.45 * n.y;
  float bounce = 0.4 + 0.6 * clamp(-n.y, 0.0, 1.0);
  vec3 light = SUN_COLOR * 3.4 * diff * shadow
             + vec3(0.62, 0.6, 0.66) * 0.42 * skyLight * ao
             + vec3(0.92, 0.74, 0.56) * 0.42 * bounce * ao;
  vec3 col = albedo * light;
  float spec = pow(max(dot(reflect(rd, n), SUN), 0.0), 32.0) * shadow;
  return col + SUN_COLOR * spec * 0.18;
}

vec3 render(vec3 ro, vec3 rd) {
  vec2 hit = march(ro, rd, 140.0, 120);
  if (hit.x < 0.0) return skyColor(rd);
  vec3 p = ro + rd * hit.x;
  vec3 n = normalAt(p);
  vec3 col = shade(p, rd, n, hit.y, true);

  // polished floor: a soft reflection of the colonnade and sky
  if (hit.y > 1.5 && n.y > 0.9 && uReflections > 0.5) {
    vec3 rr = reflect(rd, n);
    vec2 h2 = march(p + n * 0.02, rr, 60.0, 60);
    vec3 refl;
    if (h2.x < 0.0) refl = skyColor(rr);
    else {
      vec3 p2 = p + n * 0.02 + rr * h2.x;
      refl = shade(p2, rr, normalAt(p2), h2.y, false);
      refl = mix(refl, HAZE, 1.0 - exp(-h2.x * 0.02));
    }
    float fresnel = 0.12 + 0.3 * pow(1.0 - max(dot(-rd, n), 0.0), 4.0);
    col = mix(col, refl, fresnel);
  }

  // aerial haze
  col = mix(col, toLinear(HAZE) * 1.1, 1.0 - exp(-hit.x * 0.0075));
  return col;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = (frag - 0.5 * uResolution) / uResolution.y;
  vec3 forward = normalize(uTarget - uCamera);
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), forward));
  vec3 up = cross(forward, right);
  float focal = 0.5 / tan(uFov * 0.5);
  vec3 rd = normalize(forward * focal + uv.x * right + uv.y * up);

  vec3 col = render(uCamera, rd);

  // filmic tone, then a soft grade toward the site's ivory
  col = 1.0 - exp(-col * 1.35);
  col = pow(col, vec3(1.0 / 2.2));
  col = mix(col, col * vec3(1.02, 1.0, 0.96), 0.6);
  float r = length(uv);
  col = mix(col, vec3(1.0, 0.985, 0.955), uGlow * (1.0 - smoothstep(0.0, 0.95, r)));
  col = mix(col, uPaper, uPaperAmount);
  gl_FragColor = vec4(col, 1.0);
}
`;
