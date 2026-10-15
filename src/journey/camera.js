// The journey's camera path through the colonnade. The site plays a video
// rendered along this path (tools/render-journey); the path lives here so the
// renderer and the site agree on it exactly.
//
// The flight runs down the corridor and stops at each statue: the camera
// turns to face the statue's scroll, holds there (the site opens the scroll
// while the frame holds), then turns back and carries on.
import { STATUE_COUNT, statueZ, scrollPoint } from "./statues.js";

export const FLIGHT_END = 0.84; // share of the journey before the camera clears the arch

// Camera keyframes through the building: [flight share, position, look-at].
const PATH = [
  [0.0, [-0.7, 0.3, -7.5], [-10.45, 2.1, 20.8]], // on the terrace, framed like the sanctuary photograph
  [0.14, [-0.4, 0.9, -4.4], [-4.5, 2.5, 24]], // turning toward the steps
  [0.28, [0, 1.6, 1.5], [0.2, 2.8, 34]], // up the steps, between the first columns
  [0.52, [0, 1.75, 16], [0, 2.7, 52]], // halfway down the corridor
  [0.78, [0, 1.95, 33], [0, 2.5, 70]], // the arch ahead
  [0.92, [0, 2.1, 40.4], [0, 2.6, 75]], // at the threshold
  [1.0, [0, 2.3, 44.5], [0, 3.2, 80]], // through, above the clouds
];

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const smooth = (edge0, edge1, value) => {
  const x = clamp((value - edge0) / (edge1 - edge0));
  return x * x * (3 - 2 * x);
};

// Catmull-Rom through the keyframes, so the camera glides without corners.
function along(index, local, pick) {
  const at = (i) => PATH[Math.min(PATH.length - 1, Math.max(0, i))][pick];
  const p0 = at(index - 1), p1 = at(index), p2 = at(index + 1), p3 = at(index + 2);
  const t = local, t2 = t * t, t3 = t2 * t;
  return p1.map((_, k) =>
    0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3),
  );
}

/** The flight alone, without the stops at the statues. */
function flightAt(progress) {
  const flight = clamp(progress / FLIGHT_END);
  const sky = clamp((progress - FLIGHT_END) / (1 - FLIGHT_END));
  let index = 0;
  while (index < PATH.length - 2 && flight > PATH[index + 1][0]) index++;
  const local = clamp((flight - PATH[index][0]) / (PATH[index + 1][0] - PATH[index][0]));
  const eased = local * local * (3 - 2 * local) * 0.35 + local * 0.65;
  let position = along(index, eased, 1);
  let target = along(index, eased, 2);
  if (sky > 0) {
    // Out over the clouds the camera keeps drifting forward and lifts its gaze.
    const lift = smooth(0, 1, sky);
    position = [position[0], position[1] + 3.5 * lift, position[2] + 14 * lift];
    target = [target[0], target[1] + 22 * lift, target[2]];
  }
  return {
    flight,
    position,
    target,
    // a wide view of the terrace and scenery at the start; a touch wider inside
    fov: 52 + 3 * smooth(0.05, 0.3, flight),
    glow: 0.35 * smooth(0.86, 0.99, flight) * (1 - smooth(0, 0.45, sky)),
    paper: smooth(0.55, 1, sky),
  };
}

// ---- the drone flight past the statues
// Down the corridor the camera flies like a drone on one smooth curve: it
// starts banking toward each statue well before it, drifts out toward that
// side of the corridor while it eases into a hover facing the scroll, holds,
// then gathers speed again, turning back down the corridor toward the next.
// Positions and look-at points are interpolated with cubic Hermite curves:
// time-aware Catmull-Rom tangents everywhere except the hovers, where the
// velocity eases to zero.
const FLIGHT = 0.88;   // share of the journey in the colonnade; the rest is the sky
const HOLD = 0.018;    // share of the journey each hover holds still
const ahead = (z) => [0, 2.6, z + 30];
const mix = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);
const normalize = (a) => {
  const length = Math.hypot(...a);
  return a.map((v) => v / length);
};

const keys = [
  { at: [-0.7, 0.3, -7.5], look: [-10.45, 2.1, 20.8] }, // on the terrace, framed like the sanctuary photograph
  { at: [-0.4, 0.9, -4.4], look: [-4.5, 2.5, 24] },     // turning toward the steps
  { at: [0, 1.6, 1.5], look: [0.2, 2.8, 34] },          // up the steps, between the first columns
];
for (let i = 0; i < STATUE_COUNT; i++) {
  const z = statueZ(i);
  const scroll = scrollPoint(i);
  // well before: already drifting out to that side and turning toward him
  keys.push({ at: [0.3, 1.8, z - 6.2], look: mix(ahead(z - 6.2), scroll, 0.5) });
  // the hover, facing the scroll from a little out toward it
  const hover = { at: [0.8, 1.95, z - 3.6], look: scroll, hover: i };
  keys.push(hover, { ...hover, held: true });
  // moving off, with a parting look as the corridor opens up again
  keys.push({ at: [0.45, 1.86, z - 1.2], look: mix(ahead(z - 1.2), scroll, 0.35) });
}
keys.push(
  { at: [0.1, 2.05, 39.6], look: [0, 2.6, 75] },      // back on the axis, the arch ahead
  { at: [0, 2.1, 40.4], look: [0, 2.6, 75] },         // at the threshold
  { at: [0, 2.3, 44.5], look: [0, 3.2, 80] },         // through, above the clouds
);

// Interpolate the viewing direction itself, so turns spread evenly in angle.
for (const key of keys) key.dir = normalize(key.look.map((v, j) => v - key.at[j]));

// Time: travel in proportion to the distance flown plus the angle turned
// (a turn of one radian takes as long as flying TURN_COST metres), each
// hover a fixed hold.
const TURN_COST = 3.2;
{
  const length = (k) => {
    const a = keys[k - 1], b = keys[k];
    const turn = Math.acos(Math.min(1, a.dir.reduce((sum, v, j) => sum + v * b.dir[j], 0)));
    return Math.hypot(...b.at.map((v, j) => v - a.at[j])) + TURN_COST * turn;
  };
  let travel = 0;
  for (let k = 1; k < keys.length; k++) if (!keys[k].held) travel += length(k);
  const moving = FLIGHT - HOLD * STATUE_COUNT;
  let t = 0;
  keys[0].t = 0;
  for (let k = 1; k < keys.length; k++) {
    t += keys[k].held ? HOLD : (length(k) / travel) * moving;
    keys[k].t = t;
  }
}

// tangents: zero at the hovers, time-aware Catmull-Rom elsewhere
function tangent(k, pick) {
  const key = keys[k];
  if (key.hover !== undefined) return [0, 0, 0];
  const a = keys[Math.max(0, k - 1)], b = keys[Math.min(keys.length - 1, k + 1)];
  const dt = b.t - a.t || 1;
  return b[pick].map((v, j) => (v - a[pick][j]) / dt);
}
function hermite(k, u, pick) {
  const a = keys[k], b = keys[k + 1], dt = b.t - a.t;
  const ma = tangent(k, pick), mb = tangent(k + 1, pick);
  const u2 = u * u, u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
  return a[pick].map((v, j) => h00 * v + h10 * dt * ma[j] + h01 * b[pick][j] + h11 * dt * mb[j]);
}

/** Each hover's window on the journey (0-1): the site snaps to the hold as the visitor nears it. */
export const VISITS = keys
  .map((key, k) => ({ key, k }))
  .filter(({ key }) => key.held)
  .map(({ key, k }) => {
    const hold = (keys[k - 1].t + key.t) / 2;
    return { index: keys[k - 1].hover, start: hold - 0.045, hold, end: key.t + 0.012 };
  });

/** Where the camera is, and what the frame looks like, for a share of the journey (0-1). */
export function cameraAt(progress) {
  const t = clamp(progress);
  const flightT = Math.min(t, FLIGHT);
  let k = 0;
  while (k < keys.length - 2 && flightT > keys[k + 1].t) k++;
  const span = keys[k + 1].t - keys[k].t;
  const u = span > 0 ? clamp((flightT - keys[k].t) / span) : 0;
  let position = hermite(k, u, "at");
  const direction = normalize(hermite(k, u, "dir"));
  let target = position.map((v, j) => v + direction[j] * 10);
  // a gentle push in while facing a statue
  const facing = Math.max(0, ...VISITS.map((v) => 1 - smooth(0, 0.05, Math.abs(flightT - v.hold))));
  const z = position[2];
  const sky = clamp((t - FLIGHT) / (1 - FLIGHT));
  if (sky > 0) {
    // out over the clouds the camera keeps drifting forward and lifts its gaze
    const lift = smooth(0, 1, sky);
    position = [position[0], position[1] + 3.5 * lift, position[2] + 14 * lift];
    target = [target[0], target[1] + 22 * lift, target[2]];
  }
  return {
    flight: Math.min(1, t / FLIGHT),
    position,
    target,
    // a wide view of the terrace and scenery at the start; a touch wider inside
    fov: (52 + 3 * smooth(-6, 2, z)) * (1 - 0.12 * facing),
    glow: 0.35 * smooth(40.6, 44.4, z) * (1 - smooth(0, 0.45, sky)),
    paper: smooth(0.55, 1, sky),
  };
}
