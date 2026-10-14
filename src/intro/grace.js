// The garden's light: a grace-like glow that forms on the statue's head as the
// visitor starts to scroll, then opens into rays that widen until the screen is white.
// It is drawn at the garden art's own resolution (the 1208 x 680 crop of the
// 1672 x 941 painting shown in the loop) and enlarged with nearest neighbours,
// so its detail and softness match the foliage around it.
export const LIGHT_WIDTH = 1208;
export const LIGHT_HEIGHT = 680;
export const FOCUS = { x: 0.7031, y: 0.1537 }; // top of the statue's head, as a share of the frame

const clamp = (value) => Math.min(1, Math.max(0, value));
const smooth = (start, end, value) => {
  const t = clamp((value - start) / (end - start));
  return t * t * (3 - 2 * t);
};

const GOLD = "233, 192, 106";
const PALE = "255, 238, 190";
const WHITE = "255, 252, 240";

// A slender, tapering thread of light that rises from the core, leans outward
// and curls back at its tip, like the strands of a Site of Grace.
function strand(context, x, y, angle, length, width, curl, alpha) {
  const points = [];
  const steps = 18;
  for (let i = 0; i <= steps; i++) {
    const s = i / steps;
    const lean = angle + curl * s * s; // bends more toward the tip
    const reach = length * s;
    points.push([x + Math.sin(lean) * reach, y - Math.cos(lean) * reach, s]);
  }
  const left = [];
  const right = [];
  for (let i = 0; i < points.length; i++) {
    const [px, py, s] = points[i];
    const [qx, qy] = points[Math.min(points.length - 1, i + 1)];
    const [ox, oy] = points[Math.max(0, i - 1)];
    const dx = qx - ox;
    const dy = qy - oy;
    const norm = Math.hypot(dx, dy) || 1;
    const half = width * (1 - s) ** 0.8 * (0.35 + 0.65 * Math.sin(Math.min(1, s * 3) * Math.PI * 0.5));
    left.push([px - (dy / norm) * half, py + (dx / norm) * half]);
    right.push([px + (dy / norm) * half, py - (dx / norm) * half]);
  }
  const tip = points[points.length - 1];
  const gradient = context.createLinearGradient(x, y, tip[0], tip[1]);
  gradient.addColorStop(0, `rgba(${WHITE}, ${alpha})`);
  gradient.addColorStop(0.35, `rgba(${PALE}, ${alpha * 0.9})`);
  gradient.addColorStop(1, `rgba(${GOLD}, 0)`);
  context.fillStyle = gradient;
  context.beginPath();
  context.moveTo(left[0][0], left[0][1]);
  for (const [px, py] of left) context.lineTo(px, py);
  for (let i = right.length - 1; i >= 0; i--) context.lineTo(right[i][0], right[i][1]);
  context.closePath();
  context.fill();
}

function glow(context, x, y, radius, inner, alpha) {
  const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, `rgba(${inner}, ${alpha})`);
  gradient.addColorStop(0.35, `rgba(${GOLD}, ${alpha * 0.45})`);
  gradient.addColorStop(1, `rgba(${GOLD}, 0)`);
  context.fillStyle = gradient;
  context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

// One ray: a wedge whose half-width grows with distance as the rays fan out,
// gold at its edges with a white heart, fading toward its tip.
function ray(context, x, y, angle, start, length, halfWidth, fan, color, alpha) {
  if (length <= start) return;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const at = (distance, side) => {
    const half = halfWidth + distance * fan;
    return [x + cos * distance - sin * half * side, y + sin * distance + cos * half * side];
  };
  const gradient = context.createLinearGradient(x + cos * start, y + sin * start, x + cos * length, y + sin * length);
  gradient.addColorStop(0, `rgba(${color}, ${alpha})`);
  gradient.addColorStop(0.7, `rgba(${color}, ${alpha * 0.85})`);
  gradient.addColorStop(1, `rgba(${color}, 0)`);
  context.fillStyle = gradient;
  const a = at(start, -1);
  const b = at(length, -1);
  const c = at(length, 1);
  const d = at(start, 1);
  context.beginPath();
  context.moveTo(a[0], a[1]);
  context.lineTo(b[0], b[1]);
  context.lineTo(c[0], c[1]);
  context.lineTo(d[0], d[1]);
  context.closePath();
  context.fill();
}

/**
 * progress: 0-1 share of the light's scroll. Everything follows it, so
 * scrolling back up reverses the light and at the top there is none.
 *   0.00-0.07  the grace forms on the statue's head
 *   0.07-0.12  the grace alone, swaying gently
 *   0.12-0.25  it gathers: strands fold in, motes are drawn home, and the
 *              glow rounds into a ball of light
 *   0.16-0.67  rays break out of the ball and lengthen to the frame's edges
 *   0.45-0.91  rays widen and fan until they merge; 0.78-1.00 wash to white
 * time: seconds, for the sway, breathing and drifting motes
 */
export function paintLight(context, progress, time) {
  context.clearRect(0, 0, LIGHT_WIDTH, LIGHT_HEIGHT);
  if (progress <= 0) return;
  if (progress >= 1) {
    context.fillStyle = "#fff";
    context.fillRect(0, 0, LIGHT_WIDTH, LIGHT_HEIGHT);
    return;
  }

  const x = FOCUS.x * LIGHT_WIDTH;
  const y = FOCUS.y * LIGHT_HEIGHT - 4;
  const form = smooth(0, 0.07, progress);
  const swell = 0.55 + 0.45 * form + 0.25 * smooth(0.16, 0.45, progress);
  const far = Math.hypot(Math.max(x, LIGHT_WIDTH - x), Math.max(y, LIGHT_HEIGHT - y)) + 20;

  context.save();
  context.globalCompositeOperation = "lighter";

  // ---- rays, as before: they lengthen, then widen and fan until they merge
  const reach = smooth(0.16, 0.67, progress);
  if (reach > 0) {
    const rotate = progress * 0.55 + time * 0.015;
    const fanAmount = Math.tan(clamp((progress - 0.45) / 0.46) ** 1.6 * (Math.PI / 8) * 1.08);
    const halfWidth = 2.5 + 10 * smooth(0.16, 1, progress);
    const shimmer = 0.92 + 0.08 * Math.sin(time * 5.0);
    const strength = smooth(0.16, 0.27, progress);
    for (let set = 0; set < 2; set++) {
      const offset = set === 0 ? 0 : Math.PI / 8;
      const reachShare = set === 0 ? 1 : 0.6 + 0.4 * smooth(0.5, 0.83, progress);
      const length = 10 + far * reach * reachShare;
      for (let i = 0; i < 8; i++) {
        const angle = rotate + offset + (i * Math.PI) / 4;
        const color = set === 0 ? GOLD : PALE;
        // soft outer glow, then the ray, then its white heart
        ray(context, x, y, angle, 0, length, halfWidth * 2.2, fanAmount * 1.15, color, 0.16 * shimmer * strength);
        ray(context, x, y, angle, 0, length, halfWidth, fanAmount, color, 0.5 * shimmer * strength);
        ray(context, x, y, angle, 0, length * 0.86, halfWidth * 0.42, fanAmount * 0.6, WHITE, 0.75 * strength);
      }
    }
  }

  // ---- the grace. As the rays begin it gathers itself: the strands draw in
  // and shorten, the motes are pulled home, and the tall glow rounds into a
  // ball of light that the rays then pour from. Nothing lingers behind them.
  const gather = smooth(0.12, 0.25, progress);
  const ball = smooth(0.13, 0.27, progress);
  const strandLeft = 1 - gather;

  if (strandLeft > 0) {
    context.save();
    context.translate(x, y - 34 * swell * strandLeft);
    context.scale(0.55 + 0.45 * gather, 1.3 - 0.3 * gather);
    glow(context, 0, 0, 46 * swell * form * (1 - 0.35 * gather), PALE, 0.42 * form * strandLeft);
    context.restore();
  }
  glow(context, x, y - 6 * strandLeft, 20 * swell * form, WHITE, 0.5 * form);

  // [base angle, length, curl]: the middle strands stand tallest; the outer
  // ones lean out and arc over like a fountain, as at a Site of Grace
  const strands = [
    [-0.4, 44, -1.35], [-0.28, 56, -0.95], [-0.16, 66, -0.6], [-0.06, 74, -0.28], [0.0, 80, 0.0],
    [0.06, 74, 0.28], [0.16, 66, 0.6], [0.28, 56, 0.95], [0.4, 44, 1.35],
  ];
  if (strandLeft > 0.01) {
    // the strands fold inward as they shorten, curling back toward the core
    const pull = strandLeft ** 1.4;
    const fade = 1 - smooth(0.55, 1, gather);
    strands.forEach(([angle, length, curl], i) => {
      const sway = (Math.sin(time * 1.1 + i * 1.3) * 0.045 + Math.sin(time * 0.55 + i) * 0.03) * strandLeft;
      const breathe = 0.9 + 0.1 * Math.sin(time * 1.5 + i * 2.1);
      const width = (i === 4 ? 3.4 : 2.6) * (0.6 + 0.4 * strandLeft);
      const inward = angle * (1 - 0.6 * gather) + sway;
      const furl = curl * (0.9 + 0.1 * breathe) * (1 + 1.6 * gather);
      strand(context, x, y, inward, length * swell * breathe * form * pull, width, furl, 0.8 * form * fade);
    });
  }

  // the core swells into a ball: white heart, pale body, a soft gold rim,
  // with a slow pulse once it has formed
  const pulse = 1 + 0.06 * Math.sin(time * 3.1) * ball;
  const radius = (11 + 19 * ball) * swell * pulse;
  const core = context.createRadialGradient(x, y, 0, x, y, radius);
  core.addColorStop(0, `rgba(${WHITE}, ${form})`);
  core.addColorStop(0.45 + 0.1 * ball, `rgba(${WHITE}, ${(0.6 + 0.3 * ball) * form})`);
  core.addColorStop(0.75, `rgba(${PALE}, ${0.35 * ball * form})`);
  core.addColorStop(1, `rgba(${GOLD}, 0)`);
  context.fillStyle = core;
  context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  // a brief bloom as the ball completes and the rays break out of it
  const bloom = smooth(0.17, 0.24, progress) * (1 - smooth(0.24, 0.36, progress));
  if (bloom > 0) glow(context, x, y, radius * 2.6, PALE, 0.35 * bloom);

  // motes drift up and sway like embers of light, then are drawn into the ball
  for (let i = 0; i < 16; i++) {
    const life = (time * (0.16 + (i % 4) * 0.02) + i * 0.618) % 1;
    const freeX = x + Math.sin(i * 2.4 + life * 3.1) * (4 + life * 26) + ((i % 5) - 2) * 3;
    const freeY = y - 6 - life * (80 + 40 * smooth(0.16, 0.45, progress));
    const home = gather ** 0.8;
    const px = freeX + (x - freeX) * home;
    const py = freeY + (y - freeY) * home;
    const alpha = Math.sin(life * Math.PI) * (0.35 + (i % 3) * 0.2) * form * (1 - smooth(0.7, 1, gather));
    if (alpha <= 0.005) continue;
    context.fillStyle = `rgba(${i % 3 ? GOLD : WHITE}, ${alpha})`;
    const size = i % 4 === 0 ? 2 : 1.4;
    context.fillRect(px - size / 2, py - size / 2, size, size);
  }
  context.restore();

  // the last stretch of the scroll washes everything to white
  const white = smooth(0.78, 1, progress);
  if (white > 0) {
    context.fillStyle = `rgba(255, 255, 255, ${white})`;
    context.fillRect(0, 0, LIGHT_WIDTH, LIGHT_HEIGHT);
  }
}
