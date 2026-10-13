// A static marble colonnade, described as exact shapes (signed distance
// functions) and rendered by ray marching. The building never moves; only the
// camera does. Units are metres: the corridor runs along +z, the floor is y = 0.
//
// Layout: a terrace and steps lead up to a corridor between two rows of
// fourteen Corinthian columns (x = ±3, 3.2 m apart). A coffered barrel vault
// spans the corridor; a wall with pilasters closes the right-hand aisle; the
// left is open to the sky. The far wall (z = 42) has an arched opening.

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
uniform sampler2D uSky;      // the site's sky photograph
uniform sampler2D uMarble;   // seamless marble, coloured from the site's photographs
uniform float uQuality;      // 0 while moving on slow devices, 1 otherwise
uniform float uGlow;
uniform vec3 uPaper;
uniform float uPaperAmount;

#define PI 3.14159265
#define SPACING 3.2
#define LASTCOL 13.0
#define ROWX 3.0
#define COLR 0.42
#define SHAFT_TOP 6.25
#define CAP_TOP 7.0
#define SPRING 8.35          // where the vault springs from the cornice
#define VAULT_R 2.38         // inner radius of the barrel vault
#define ENDZ 42.0
#define FRONTZ -0.7

const vec3 SUN = normalize(vec3(-0.84, 0.42, -0.22));   // toward the sun: low, from the left
const vec3 SUN_COLOR = vec3(1.0, 0.86, 0.72);
const vec3 HAZE = vec3(0.95, 0.89, 0.84);

// Ids: 1 column, 2 floor, 3 stone (walls, entablature), 4 vault
float flutes = 1.0; // shadows and occlusion skip fine detail, which only adds noise

// ---------- helpers
float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}
float sdRoundBox(vec3 p, vec3 b, float r) {
  vec3 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r;
}
float sdTorusY(vec3 p, float R, float r) {
  vec2 q = vec2(length(p.xz) - R, p.y);
  return length(q) - r;
}
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// ---------- the building
float column(vec3 q) {
  float bound = sdBox(q - vec3(0.0, 3.6, 0.0), vec3(0.72, 3.6, 0.72));
  // the quick box bound speeds up camera rays; shadows need the exact, continuous distance
  if (flutes > 0.5 && bound > 0.5) return bound;
  // Attic base: plinth, torus, scotia, torus
  float plinth = sdBox(q - vec3(0.0, 0.22, 0.0), vec3(0.62, 0.22, 0.62));
  float torus1 = sdTorusY(q - vec3(0.0, 0.54, 0.0), COLR + 0.1, 0.1);
  float scotia = max(length(q.xz) - (COLR + 0.03), abs(q.y - 0.68) - 0.06);
  float torus2 = sdTorusY(q - vec3(0.0, 0.8, 0.0), COLR + 0.05, 0.065);
  // fluted shaft with a gentle entasis
  float h = clamp((q.y - 0.85) / (SHAFT_TOP - 0.85), 0.0, 1.0);
  float radius = COLR * (1.0 - 0.09 * h * h);
  float angle = atan(q.z, q.x);
  float flute = flutes * 0.024 * smoothstep(0.3, 1.0, abs(sin(angle * 10.0)));
  float shaft = max(length(q.xz) - (radius - flute), abs(q.y - 3.55) - 2.75);
  float astragal = sdTorusY(q - vec3(0.0, SHAFT_TOP, 0.0), radius + 0.02, 0.05);
  // Corinthian bell: flares upward, with two rows of leaves and corner volutes
  float y = q.y - SHAFT_TOP;
  float bell = mix(radius, 0.58, smoothstep(0.0, 0.75, y));
  float leaves1 = pow(abs(cos(angle * 4.0)), 3.0) * smoothstep(0.02, 0.2, y) * (1.0 - smoothstep(0.3, 0.42, y));
  float leaves2 = pow(abs(cos(angle * 4.0 + PI / 4.0)), 3.0) * smoothstep(0.28, 0.45, y) * (1.0 - smoothstep(0.58, 0.7, y));
  float curl = flutes * 0.012 * sin(angle * 24.0) * smoothstep(0.05, 0.6, y);
  bell += 0.085 * (leaves1 + leaves2) + curl;
  float capital = max((length(q.xz) - bell) * 0.75, abs(y - 0.37) - 0.37);
  vec2 corner = vec2(abs(q.x), abs(q.z)) - vec2(0.48);
  float volute = length(vec2(length(corner) - 0.0, y - 0.62)) - 0.11;
  float abacus = sdRoundBox(q - vec3(0.0, CAP_TOP + 0.05, 0.0), vec3(0.66, 0.08, 0.66), 0.03);
  float d = min(min(plinth, torus1), min(scotia, torus2));
  d = min(d, min(shaft, astragal));
  d = min(d, min(min(capital, volute), abacus));
  return d;
}

// Moulded entablature: architrave, frieze and a cornice with a rounded lip.
float entablature(vec3 p, float x0) {
  vec3 q = vec3(p.x - x0, p.y, p.z - 20.6);
  float len = 21.35;
  float architrave = sdBox(q - vec3(0.0, CAP_TOP + 0.38, 0.0), vec3(0.62, 0.25, len));
  float fascia = sdBox(q - vec3(0.0, CAP_TOP + 0.66, 0.0), vec3(0.66, 0.04, len));
  float frieze = sdBox(q - vec3(0.0, CAP_TOP + 0.9, 0.0), vec3(0.58, 0.2, len));
  float cornice = sdBox(q - vec3(0.0, CAP_TOP + 1.2, 0.0), vec3(0.8, 0.1, len + 0.15));
  float lip = max(length(vec2(abs(q.x) - 0.74, q.y - (CAP_TOP + 1.12))) - 0.12, abs(q.z) - len - 0.15);
  return min(min(architrave, fascia), min(frieze, min(cornice, lip)));
}

// Coffered barrel vault with a rib over every pair of columns.
float vault(vec3 p) {
  vec2 v = vec2(p.x, p.y - SPRING);
  float dist = length(v);
  float shell = max(max(VAULT_R - dist, dist - (VAULT_R + 0.7)), -v.y);
  shell = max(shell, abs(p.z - 20.6) - 21.4);
  if (flutes > 0.5) {
    float theta = atan(v.y, v.x);
    float s = theta * VAULT_R;
    float cellW = PI * VAULT_R / 5.0;
    float sl = s - cellW * (floor(s / cellW) + 0.5);
    float zl = p.z - 1.6 * floor(p.z / 1.6) - 0.8;
    float coffer = sdRoundBox(vec3(sl, dist - (VAULT_R + 0.04), zl), vec3(cellW * 0.37, 0.12, 0.6), 0.16);
    coffer = max(coffer, -v.y + 0.25);
    float rosette = length(vec3(sl, (dist - (VAULT_R + 0.17)) * 1.6, zl)) - 0.085;
    // rosettes only inside the vault, never repeated out into the sky
    rosette = max(rosette, max(abs(p.z - 20.6) - 21.0, 0.3 - v.y));
    shell = min(max(shell, -coffer), rosette);
  }
  float zr = p.z - SPACING * clamp(floor(p.z / SPACING + 0.5), 0.0, LASTCOL);
  float rib = max(max(abs(dist - (VAULT_R - 0.02)) - 0.1, abs(zr) - 0.2), -v.y);
  return min(shell, rib);
}

vec2 map(vec3 p) {
  // column rows on both sides, repeated along z
  vec3 q = vec3(abs(p.x) - ROWX, p.y, p.z - SPACING * clamp(floor(p.z / SPACING + 0.5), 0.0, LASTCOL));
  vec2 res = vec2(column(q), 1.0);

  // entablature and attic over both rows, the vault between them
  float stone = min(entablature(p, -ROWX), entablature(p, ROWX));
  float attic = sdBox(vec3(abs(p.x) - ROWX, p.y - (SPRING + 1.55), p.z - 20.6), vec3(0.66, 1.55, 21.4));
  stone = min(stone, attic);

  // right aisle: outer wall with pilasters, and a beamed ceiling
  float wall = sdBox(p - vec3(6.55, 4.6, 20.6), vec3(0.3, 4.6, 21.4));
  float pz = p.z - SPACING * clamp(floor(p.z / SPACING + 0.5), 0.0, LASTCOL);
  float pilaster = sdBox(vec3(p.x - 6.18, p.y - 3.6, pz), vec3(0.1, 3.6, 0.42));
  float aisleCeiling = sdBox(p - vec3(5.0, SPRING + 0.25, 20.6), vec3(1.6, 0.25, 21.4));
  float beam = sdBox(vec3(p.x - 4.9, p.y - (SPRING - 0.15), pz), vec3(1.4, 0.2, 0.2));
  stone = min(stone, min(min(wall, pilaster), min(aisleCeiling, beam)));

  // far wall with a moulded arch: archivolt, keystone and flanking pilasters
  float endWall = sdBox(p - vec3(1.5, 5.6, ENDZ + 0.4), vec3(5.4, 5.6, 0.4));
  vec2 a = vec2(p.x, p.y - 4.2);
  float opening = min(sdBox(vec3(p.x, p.y - 2.1, p.z - ENDZ - 0.4), vec3(1.3, 2.1, 1.0)),
                      max(length(a) - 1.3, abs(p.z - ENDZ - 0.4) - 1.0));
  endWall = max(endWall, -opening);
  float archivolt = max(max(abs(length(a) - 1.48) - 0.15, abs(p.z - ENDZ + 0.08) - 0.1), -a.y);
  float jambs = sdBox(vec3(abs(p.x) - 1.48, p.y - 2.1, p.z - ENDZ + 0.08), vec3(0.15, 2.1, 0.1));
  float impost = sdBox(vec3(abs(p.x) - 1.48, p.y - 4.15, p.z - ENDZ + 0.1), vec3(0.24, 0.07, 0.13));
  float keystone = sdBox(vec3(p.x, p.y - 5.72, p.z - ENDZ + 0.1), vec3(0.18 - (p.y - 5.72) * 0.12, 0.24, 0.13));
  float endPilasters = sdBox(vec3(abs(p.x) - 2.15, p.y - 3.5, p.z - ENDZ + 0.08), vec3(0.18, 3.5, 0.1));
  endWall = min(endWall, min(min(archivolt, jambs), min(min(impost, keystone), endPilasters)));
  stone = min(stone, endWall);
  if (stone < res.x) res = vec2(stone, 3.0);

  float ceiling = vault(p);
  if (ceiling < res.x) res = vec2(ceiling, 4.0);

  // corridor floor, steps and the lower terrace with its parapet
  float floorSlab = sdBox(p - vec3(1.1, -1.5, 20.6), vec3(5.7, 1.5, 21.6));
  float step1 = sdBox(p - vec3(2.35, -0.1, -1.25), vec3(4.45, 0.1, 0.55));
  float step2 = sdBox(p - vec3(2.35, -0.3, -1.8), vec3(4.45, 0.1, 0.55));
  float step3 = sdBox(p - vec3(2.35, -0.5, -2.35), vec3(4.45, 0.1, 0.55));
  // the front-left corner stands on a raised block, the steps run off to its right
  float pedestal = sdRoundBox(p - vec3(-3.15, -0.3, -1.25), vec3(1.25, 0.32, 0.6), 0.02);
  step1 = min(step1, pedestal);
  float terrace = sdBox(p - vec3(0.0, -1.6, -13.4), vec3(14.0, 1.0, 10.6));
  float parapet = sdRoundBox(p - vec3(-13.6, -0.15, -13.4), vec3(0.32, 0.47, 10.6), 0.04);
  // the low wall along the terrace edge, running left from the front block
  parapet = min(parapet, sdRoundBox(p - vec3(-9.2, -0.3, -3.05), vec3(4.8, 0.32, 0.24), 0.04));
  float ground = min(min(floorSlab, terrace), min(min(step1, step2), min(step3, parapet)));
  if (ground < res.x) res = vec2(ground, 2.0);
  return res;
}

vec3 normalAt(vec3 p) {
  vec2 e = vec2(0.0012, 0.0);
  return normalize(vec3(
    map(p + e.xyy).x - map(p - e.xyy).x,
    map(p + e.yxy).x - map(p - e.yxy).x,
    map(p + e.yyx).x - map(p - e.yyx).x));
}

vec2 march(vec3 ro, vec3 rd, float far, int steps) {
  float t = 0.02;
  for (int i = 0; i < 140; i++) {
    if (i >= steps) break;
    vec2 h = map(ro + rd * t);
    if (h.x < 0.0007 * t) return vec2(t, h.y);
    t += h.x * 0.85;
    if (t > far) break;
  }
  return vec2(-1.0, 0.0);
}

float softShadow(vec3 ro, vec3 rd, float k) {
  flutes = 0.0;
  float res = 1.0, t = 0.06;
  for (int i = 0; i < 40; i++) {
    float h = map(ro + rd * t).x;
    res = min(res, k * h / t);
    t += clamp(h, 0.04, 0.7);
    if (res < 0.01 || t > 32.0) break;
  }
  flutes = 1.0;
  res = clamp(res, 0.0, 1.0);
  return res * res * (3.0 - 2.0 * res);
}

float occlusion(vec3 p, vec3 n) {
  flutes = 0.0;
  float occ = 0.0, w = 1.0;
  for (int i = 1; i <= 5; i++) {
    float h = 0.08 * float(i) * float(i);
    occ += w * (h - map(p + n * h).x);
    w *= 0.62;
  }
  flutes = 1.0;
  return clamp(1.0 - 1.1 * occ, 0.0, 1.0);
}

vec3 toLinear(vec3 c) { return pow(c, vec3(2.2)); }

// The site's sky photograph wrapped around the scene by direction, a little warmer.
vec3 skyColor(vec3 rd) {
  float az = atan(rd.x, rd.z);
  float el = asin(clamp(rd.y, -1.0, 1.0));
  vec2 uv = vec2(0.36 + az / 2.2, 0.53 - el / 1.05);
  uv = 1.0 - abs(1.0 - mod(uv, 2.0));
  vec3 c = toLinear(texture2D(uSky, uv).rgb) * vec3(1.06, 1.0, 0.93);
  float sun = max(dot(rd, SUN), 0.0);
  return c + vec3(0.32, 0.2, 0.1) * pow(sun, 8.0) + vec3(0.08, 0.045, 0.015) * pow(sun, 2.0);
}

vec3 marbleTexture(vec2 uv) { return toLinear(texture2D(uMarble, uv).rgb); }

vec3 albedoAt(vec3 p, vec3 n, float m) {
  const float TILE = 2.4; // metres per repeat of the marble texture
  if (m < 1.5) {
    // columns: wrap the marble around the shaft so veins run continuously
    vec3 q = vec3(abs(p.x) - ROWX, p.y, p.z - SPACING * clamp(floor(p.z / SPACING + 0.5), 0.0, LASTCOL));
    float seed = floor(p.z / SPACING + 0.5) + (p.x > 0.0 ? 17.0 : 0.0);
    float angle = atan(q.z, q.x);
    return marbleTexture(vec2(angle * 0.42 / TILE + seed * 0.37, p.y / TILE + seed * 0.21));
  }
  if (m < 2.5 && n.y > 0.5) {
    // floor: large polished slabs, each cut from a different part of the block
    vec2 slab = floor(p.xz / 1.8);
    vec2 offset = vec2(hash12(slab), hash12(slab + 7.3));
    vec3 c = marbleTexture(p.xz / (TILE * 1.4) + offset * 3.0);
    c = mix(c, vec3(0.84, 0.8, 0.75), 0.32); // polished slabs show finer, quieter veins
    c *= 0.95 + 0.08 * hash12(slab + 3.1);
    vec2 g = abs(fract(p.xz / 1.8) - 0.5);
    float joint = smoothstep(0.494, 0.5, max(g.x, g.y));
    return mix(c, c * 0.72, joint);
  }
  // everything else: tri-planar projection
  vec3 w = pow(abs(n), vec3(4.0));
  w /= w.x + w.y + w.z;
  vec3 c = marbleTexture(p.zy / TILE) * w.x + marbleTexture(p.xz / TILE + 0.5) * w.y + marbleTexture(p.xy / TILE + 0.25) * w.z;
  // broad walls and the vault read better with quieter veining
  vec3 quiet = mix(c, vec3(0.83, 0.79, 0.74), 0.38);
  return m > 3.5 ? quiet * vec3(0.98, 0.96, 0.94) : quiet;
}

vec3 shade(vec3 p, vec3 rd, vec3 n, float m, bool full) {
  vec3 albedo = albedoAt(p, n, m);
  float diff = max(dot(n, SUN), 0.0);
  float shadow = full && diff > 0.0 ? softShadow(p + n * 0.03, SUN, 10.0) : (full ? 0.0 : 1.0);
  float ao = full ? occlusion(p, n) : 1.0;
  float skyLight = 0.5 + 0.5 * n.y;
  vec3 light = SUN_COLOR * 3.0 * diff * shadow
             + vec3(0.62, 0.62, 0.7) * 0.34 * skyLight * ao
             + vec3(0.9, 0.76, 0.62) * 0.1 * ao;
  // Light bounced up from the sunlit floor: surfaces facing down (the vault,
  // the undersides of the entablature) glow where the floor below is in sun,
  // which lays soft stripes of light and shadow across the ceiling.
  float down = clamp(-n.y, 0.0, 1.0);
  vec3 bounce = vec3(0.95, 0.8, 0.66) * 0.26 * ao * (0.35 + 0.65 * down);
  if (full && down > 0.2 && uQuality > 0.5) {
    vec3 below = vec3(p.x + 0.9, 0.02, p.z - 0.6);
    float lit = softShadow(below, SUN, 4.0);
    bounce *= 0.35 + 1.9 * lit * down;
  }
  light += bounce;
  vec3 col = albedo * light;
  float spec = pow(max(dot(reflect(rd, n), SUN), 0.0), m > 1.5 && m < 2.5 ? 60.0 : 18.0) * shadow;
  return col + SUN_COLOR * spec * (m > 1.5 && m < 2.5 ? 0.5 : 0.1);
}

// Sun shafts: how much sunlit haze the eye ray crosses before it hits something.
float sunShafts(vec3 ro, vec3 rd, float tmax) {
  float jitter = hash12(gl_FragCoord.xy);
  float span = min(tmax, 42.0);
  float lit = 0.0;
  flutes = 0.0;
  for (int i = 0; i < 10; i++) {
    float t = (float(i) + jitter) / 10.0 * span;
    vec3 p = ro + rd * t;
    float v = 1.0, s = 0.1;
    for (int j = 0; j < 14; j++) {
      float h = map(p + SUN * s).x;
      if (h < 0.01) { v = 0.0; break; }
      s += max(h, 0.15);
      if (s > 22.0) break;
    }
    lit += v;
  }
  flutes = 1.0;
  return lit / 10.0;
}

vec3 render(vec3 ro, vec3 rd) {
  vec2 hit = march(ro, rd, 150.0, 140);
  vec3 col;
  float dist = hit.x < 0.0 ? 150.0 : hit.x;
  if (hit.x < 0.0) {
    col = skyColor(rd);
  } else {
    vec3 p = ro + rd * hit.x;
    vec3 n = normalAt(p);
    col = shade(p, rd, n, hit.y, true);
    // polished floor: a soft reflection of the colonnade and sky
    if (hit.y > 1.5 && hit.y < 2.5 && n.y > 0.9) {
      vec3 rr = reflect(rd, n);
      vec3 refl;
      vec2 h2 = uQuality > 0.5 ? march(p + n * 0.02, rr, 60.0, 64) : vec2(-1.0, 0.0);
      if (h2.x < 0.0) refl = skyColor(rr);
      else {
        vec3 p2 = p + n * 0.02 + rr * h2.x;
        refl = shade(p2, rr, normalAt(p2), h2.y, false) * 0.8;
        refl = mix(refl, toLinear(HAZE), 1.0 - exp(-h2.x * 0.02));
      }
      float fresnel = 0.1 + 0.35 * pow(1.0 - max(dot(-rd, n), 0.0), 5.0);
      col = mix(col, refl, fresnel);
    }
    col = mix(col, toLinear(HAZE) * 1.1, 1.0 - exp(-hit.x * 0.005));
  }
  if (uQuality > 0.5) {
    // Sun shafts: air in the colonnade's shadow reads a touch darker, sunlit
    // air a touch brighter, so beams show without washing out the sky.
    float shafts = sunShafts(ro, rd, dist);
    float phase = 0.6 + 0.4 * pow(max(dot(rd, SUN), 0.0), 3.0);
    float depth = 1.0 - exp(-min(dist, 42.0) * 0.06);
    col *= mix(1.0, 0.9 + 0.2 * shafts * phase, depth);
  }
  return col;
}

// Identity through the mid-tones (so the sky photograph keeps its contrast),
// with a soft shoulder for sunlit marble.
vec3 shoulder(vec3 x) {
  const float knee = 0.72;
  return mix(x, knee + (1.0 - knee) * (1.0 - exp(-(x - knee) / (1.0 - knee))), step(knee, x));
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

  // film-like tone curve, then a warm, soft grade toward the site's ivory
  col = shoulder(col);
  col = pow(col, vec3(1.0 / 2.2));
  col = mix(col, col * vec3(1.02, 1.0, 0.97) + vec3(0.008, 0.004, 0.0), 0.7);
  float r = length(uv);
  col *= 1.0 - 0.12 * smoothstep(0.45, 1.05, r);
  col = mix(col, vec3(1.0, 0.985, 0.955), uGlow * (1.0 - smoothstep(0.0, 0.95, r)));
  col = mix(col, uPaper, uPaperAmount);
  col += (hash12(frag + 0.37) - 0.5) / 255.0 * 1.5; // dither against banding
  gl_FragColor = vec4(col, 1.0);
}
`;
