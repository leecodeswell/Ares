// The garden's light: a grace-like glow that kindles on the statue's head at
// the first scroll, then opens into rays that widen until the screen is white.
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
 * progress: 0-1 share of the light's scroll (0 = not yet scrolled)
 * kindle: 0-1, how far the grace has formed since the first scroll input
 * time: seconds, for the gentle sway and drifting motes
 */
export function paintLight(context, progress, kindle, time) {
  context.clearRect(0, 0, LIGHT_WIDTH, LIGHT_HEIGHT);
  if (kindle <= 0) return;
  if (progress >= 1) {
    context.fillStyle = "#fff";
    context.fillRect(0, 0, LIGHT_WIDTH, LIGHT_HEIGHT);
    return;
  }

  const x = FOCUS.x * LIGHT_WIDTH;
  const y = FOCUS.y * LIGHT_HEIGHT - 6;
  const form = smooth(0, 1, kindle);
  const swell = 1 + 0.35 * smooth(0, 0.4, progress);
  const far = Math.hypot(Math.max(x, LIGHT_WIDTH - x), Math.max(y, LIGHT_HEIGHT - y)) + 20;

  context.save();
  context.globalCompositeOperation = "lighter";

  // ---- rays, as before: they lengthen, then widen and fan until they merge
  const reach = smooth(0.04, 0.62, progress);
  if (reach > 0) {
    const rotate = progress * 0.55 + time * 0.015;
    const fanAmount = Math.tan(clamp((progress - 0.42) / 0.48) ** 1.6 * (Math.PI / 8) * 1.08);
    const halfWidth = 2.5 + 9 * progress;
    const shimmer = 0.92 + 0.08 * Math.sin(time * 5.0);
    for (let set = 0; set < 2; set++) {
      const offset = set === 0 ? 0 : Math.PI / 8;
      const reachShare = set === 0 ? 1 : 0.6 + 0.4 * smooth(0.5, 0.8, progress);
      const length = 10 + far * reach * reachShare;
      for (let i = 0; i < 8; i++) {
        const angle = rotate + offset + (i * Math.PI) / 4;
        const color = set === 0 ? GOLD : PALE;
        // soft outer glow, then the ray, then its white heart
        ray(context, x, y, angle, 6, length, halfWidth * 2.2, fanAmount * 1.15, color, 0.16 * shimmer);
        ray(context, x, y, angle, 6, length, halfWidth, fanAmount, color, 0.5 * shimmer);
        ray(context, x, y, angle, 6, length * 0.86, halfWidth * 0.42, fanAmount * 0.6, WHITE, 0.75);
      }
    }
  }

  // ---- the grace: halo, curling strands, a bright core and rising motes
  glow(context, x, y - 10, 62 * swell * form, PALE, 0.46 * form);
  glow(context, x, y - 4, 22 * swell * form, WHITE, 0.6 * form);

  const strands = [
    [-0.95, 30, -0.55], [-0.55, 40, -0.4], [-0.2, 48, -0.25], [0.05, 54, 0.15],
    [0.3, 46, 0.3], [0.62, 38, 0.45], [0.98, 28, 0.6],
  ];
  strands.forEach(([angle, length, curl], i) => {
    const sway = Math.sin(time * 1.15 + i * 1.7) * 0.07 + Math.sin(time * 0.6 + i) * 0.04;
    const breathe = 0.9 + 0.1 * Math.sin(time * 1.6 + i * 2.3);
    strand(context, x, y, angle * 0.62 + sway, length * 1.3 * swell * breathe * form, 3.3, curl, 0.82 * form);
  });

  // core with a faint four-point glint
  glow(context, x, y, 9 * swell, WHITE, form);
  const glint = (0.55 + 0.45 * Math.sin(time * 2.2)) * form;
  context.fillStyle = `rgba(${WHITE}, ${0.4 * glint})`;
  context.fillRect(x - 13 * swell, y - 0.5, 26 * swell, 1);
  context.fillRect(x - 0.5, y - 15 * swell, 1, 26 * swell);

  // motes drift up and sway like embers of light
  for (let i = 0; i < 16; i++) {
    const life = (time * (0.16 + (i % 4) * 0.02) + i * 0.618) % 1;
    const px = x + Math.sin(i * 2.4 + life * 3.1) * (6 + life * 22) + ((i % 5) - 2) * 3;
    const py = y - 4 - life * (60 + 40 * smooth(0, 0.4, progress));
    const alpha = Math.sin(life * Math.PI) * (0.35 + (i % 3) * 0.2) * form;
    context.fillStyle = `rgba(${i % 3 ? GOLD : WHITE}, ${alpha})`;
    const size = i % 4 === 0 ? 2 : 1.4;
    context.fillRect(px - size / 2, py - size / 2, size, size);
  }
  context.restore();

  // the last stretch of the scroll washes everything to white
  const white = smooth(0.8, 1, progress);
  if (white > 0) {
    context.fillStyle = `rgba(255, 255, 255, ${white})`;
    context.fillRect(0, 0, LIGHT_WIDTH, LIGHT_HEIGHT);
  }
}
