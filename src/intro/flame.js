// Draw the light in the garden's own pixel space, then enlarge with nearest
// neighbours. Its texture stays the same size as the foliage on every screen.
export const LIGHT_WIDTH = 960;
export const LIGHT_HEIGHT = 540;
export const FOCUS = { x: 0.7031, y: 0.1537 };

const clamp = (value) => Math.min(1, Math.max(0, value));
const smooth = (start, end, value) => {
  const t = clamp((value - start) / (end - start));
  return t * t * (3 - 2 * t);
};

function tongue(context, x, y, height, width, bend, color) {
  context.fillStyle = color;
  context.beginPath();
  context.moveTo(x, y);
  context.bezierCurveTo(x - width, y - height * 0.12, x - width * 0.7, y - height * 0.4, x + bend, y - height);
  context.bezierCurveTo(x + bend - width * 0.25, y - height * 0.55, x + width, y - height * 0.3, x + width * 0.4, y - height * 0.1);
  context.quadraticCurveTo(x + width * 0.2, y, x, y);
  context.fill();
}

export function paintFlame(context, progress, time) {
  context.clearRect(0, 0, LIGHT_WIDTH, LIGHT_HEIGHT);
  if (progress <= 0) return;
  if (progress >= 1) {
    context.fillStyle = "#fff";
    context.fillRect(0, 0, LIGHT_WIDTH, LIGHT_HEIGHT);
    return;
  }

  const appear = smooth(0, 0.07, progress);
  const bloom = smooth(0.53, 1, progress);
  const x = Math.round(FOCUS.x * LIGHT_WIDTH);
  const y = Math.round(FOCUS.y * LIGHT_HEIGHT - 5);
  const flicker = Math.sin(time * 2.3) * 0.6 + Math.sin(time * 4.1) * 0.35;
  const height = 27 + flicker * 2 + bloom * 15;
  const bend = 3 + Math.sin(time * 1.7) * 3;

  context.save();
  context.globalAlpha = appear;

  // A local amber halo belongs to the flame; the broader, pale light only
  // arrives near the end of the scroll, as the garden gives way to the hero.
  const radius = 24 + bloom * LIGHT_WIDTH * 1.3;
  const glow = context.createRadialGradient(x, y - 12, 0, x, y - 12, radius);
  glow.addColorStop(0, `rgba(255, 236, 171, ${0.23 + bloom * 0.57})`);
  glow.addColorStop(0.3, `rgba(251, 222, 151, ${0.1 + bloom * 0.57})`);
  glow.addColorStop(1, "rgba(255, 249, 229, 0)");
  context.fillStyle = glow;
  context.fillRect(x - radius, y - 12 - radius, radius * 2, radius * 2);

  // A handful of fine gold motes rise instead of radiating like sunbeams.
  for (let i = 0; i < 11; i++) {
    const life = (time * (0.12 + (i % 3) * 0.015) + i * 0.618) % 1;
    const drift = Math.sin(i * 2.4 + life * 2.1) * (5 + life * 12);
    const px = Math.round(x + drift);
    const py = Math.round(y - 5 - life * (49 + bloom * 45));
    context.globalAlpha = appear * Math.sin(life * Math.PI) * (0.22 + (i % 3) * 0.12);
    context.fillStyle = i % 3 ? "#f0cf82" : "#fff4cd";
    context.fillRect(px, py, 1, i % 4 === 0 ? 2 : 1);
  }

  context.globalAlpha = appear * 0.45;
  tongue(context, x - 2, y - 2, height * 0.84, 3, -5 - bend * 0.3, "#e8c36f");
  context.globalAlpha = appear;
  tongue(context, x, y, height, 6 + bloom * 2, bend, "#c79b4e");
  tongue(context, x, y - 1, height - 2, 4.7 + bloom, bend, "#efd18b");
  tongue(context, x, y - 2, height * 0.79, 3.2, bend * 0.5, "#ffe8aa");
  tongue(context, x, y - 3, height * 0.53, 2, -bend * 0.25, "#fff9de");
  context.restore();

  const white = smooth(0.72, 1, progress);
  if (white > 0) {
    context.fillStyle = `rgba(255, 255, 255, ${white})`;
    context.fillRect(0, 0, LIGHT_WIDTH, LIGHT_HEIGHT);
  }
}
