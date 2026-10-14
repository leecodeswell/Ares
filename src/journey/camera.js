// The journey's camera path through the colonnade. The site plays a video
// rendered along this path (tools/render-journey); the path lives here so the
// renderer and any future re-render agree on it exactly.

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

/** Where the camera is, and what the frame looks like, for a share of the journey (0-1). */
export function cameraAt(progress) {
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
