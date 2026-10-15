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

// ---- the stops at the statues
const VISIT = 0.075;   // share of the journey each stop takes: turn in, hold, turn back
const TURN = 0.38;     // share of a stop spent turning in (and again turning back)
const AHEAD = 3.4;     // the camera stops this far short of the statue, along the corridor

// Where along the flight the camera is AHEAD metres short of each statue.
const stopFlights = Array.from({ length: STATUE_COUNT }, (_, i) => {
  const wanted = statueZ(i) - AHEAD;
  let best = 0;
  for (let k = 0; k <= 2000; k++) {
    const f = (k / 2000) * FLIGHT_END;
    if (flightAt(f).position[2] <= wanted) best = f;
  }
  return best;
});

// The journey's timeline: travel between stops gets the remaining share in
// proportion to the flight it covers.
const travel = 1 - VISIT * STATUE_COUNT;
const segments = [];
{
  let t = 0, f = 0;
  stopFlights.forEach((stop, i) => {
    const span = (stop - f) * travel;
    segments.push({ kind: "travel", t0: t, t1: t + span, f0: f, f1: stop });
    t += span;
    segments.push({ kind: "visit", t0: t, t1: t + VISIT, f0: stop, f1: stop, index: i });
    t += VISIT;
    f = stop;
  });
  segments.push({ kind: "travel", t0: t, t1: 1, f0: f, f1: 1 });
}

/** Each stop's window on the journey (0-1), and the moment its frame holds on the statue. */
export const VISITS = segments.filter((s) => s.kind === "visit").map((s) => ({
  index: s.index,
  start: s.t0,
  hold: (s.t0 + s.t1) / 2,
  end: s.t1,
}));

const normalize = (a) => {
  const length = Math.hypot(...a);
  return a.map((v) => v / length);
};

/** Where the camera is, and what the frame looks like, for a share of the journey (0-1). */
export function cameraAt(progress) {
  const t = clamp(progress);
  const segment = segments.find((s) => t <= s.t1) || segments[segments.length - 1];
  const local = segment.t1 > segment.t0 ? (t - segment.t0) / (segment.t1 - segment.t0) : 0;
  if (segment.kind === "travel") return flightAt(segment.f0 + (segment.f1 - segment.f0) * local);
  // a stop: turn toward the statue's scroll, hold, turn back
  const base = flightAt(segment.f0);
  const look = smooth(0, TURN, local) * (1 - smooth(1 - TURN, 1, local));
  const ahead = normalize(base.target.map((v, k) => v - base.position[k]));
  const toward = normalize(scrollPoint(segment.index).map((v, k) => v - base.position[k]));
  const direction = normalize(ahead.map((v, k) => v + (toward[k] - v) * look));
  return {
    ...base,
    target: base.position.map((v, k) => v + direction[k] * 10),
    fov: base.fov * (1 - 0.14 * look), // a gentle push in on the statue
  };
}
