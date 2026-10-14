import "./statue.css";
import { STATUE_FRAMES } from "./statue-frames.js";

// Ares lowers his gaze as the visitor scrolls: first his eyes come level and
// his head stirs, then he bows his head toward the colonnade below. Nothing
// stops for it: he turns while the page scrolls on, as if watching the
// visitor go down past him, and lands on his last frame just before his eyes
// leave the top of the screen. Frame 0 is the photograph
// itself: no overlay is drawn, so the opening pose is the untouched image.
// Each later frame is a pre-rendered patch of the photograph (the head moved
// rigidly, the neck bent, the columns behind rebuilt), drawn on a canvas that
// shares the photograph's box and transform.

// Where his eye ends up once he has bowed and where his chin is at rest, on
// each photograph (its own pixels; the eye from tools/statue-turn/*.json carried
// through the final head and neck turn). He starts turning as soon as his
// whole head has risen into view (his chin clears the bottom of the screen)
// and lands on his last frame just before that eye slips under the site
// header, the top of what can be seen. Margins are shares of the screen height.
const EYES = { desktop: [1105, 440], mobile: [477, 578] };
const CHINS = { desktop: 560, mobile: 700 };
const TURN_START = 0.03;
const TURN_END = 0.03;

const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
const hold = document.querySelector("[data-statue-hold]");
const canvas = hold?.querySelector("[data-statue-canvas]");
const photo = hold?.querySelector("img[data-film-image]");

if (hold && canvas && photo && Object.keys(STATUE_FRAMES).length) setUpTurn();

function setUpTurn() {
  const layer = canvas.parentElement;
  const context = canvas.getContext("2d");
  const loaded = new Map(); // variant name -> array of decoded frames (or null)
  let shown = -1;
  let shownKey = "";
  let framePending = false;

  // The <picture> picks the portrait photograph on narrow screens.
  const variantName = () => (/mobile/.test(photo.currentSrc) ? "mobile" : "desktop");

  // Fetch a variant's frames in order, so the first ones are ready first.
  function load(name) {
    const variant = STATUE_FRAMES[name];
    if (!variant || loaded.has(name)) return;
    const images = variant.frames.map(() => null);
    loaded.set(name, images);
    variant.frames.reduce(
      (previous, frame, index) =>
        previous.then(() => {
          const image = new Image();
          image.decoding = "async";
          image.src = frame.src;
          return image
            .decode()
            .then(() => {
              images[index] = image;
              shown = -1;
              schedule();
            })
            .catch(() => {});
        }),
      Promise.resolve(),
    );
  }

  function hide() {
    layer.classList.remove("is-turning");
    layer.dataset.frame = "0";
    shown = 0;
  }

  function paint() {
    framePending = false;
    if (motion.matches) return hide();
    const name = variantName();
    const variant = STATUE_FRAMES[name];
    const images = loaded.get(name);
    if (!variant || !images) return hide();
    const t = turnAt(name, variant);
    let frame = Math.round(t * variant.frames.length);
    // a frame still downloading falls back to the nearest earlier one
    while (frame > 0 && !images[frame - 1]) frame -= 1;
    if (frame === 0) return hide();

    // Size the canvas to its box in device pixels; the CSS transform it shares
    // with the photograph is applied on top, exactly as for the image.
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    // exact layout size (clientWidth rounds to whole pixels)
    const box = getComputedStyle(canvas);
    const width = parseFloat(box.width);
    const height = parseFloat(box.height);
    const key = `${name}|${width}x${height}@${ratio}`;
    if (frame === shown && key === shownKey) return;
    if (key !== shownKey) {
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
    }
    shownKey = key;
    shown = frame;

    // object-fit: cover, at the photograph's own object-position. The browser
    // snaps the photo's drawn rectangle to whole device pixels, so do the same
    // and the frames land on the pixels the photo uses.
    const scale = Math.max(width / variant.width, height / variant.height);
    const [px, py] = getComputedStyle(photo).objectPosition.split(" ").map((v) => parseFloat(v) / 100);
    const offsetX = (width - variant.width * scale) * px;
    const offsetY = (height - variant.height * scale) * py;
    const left = Math.round(offsetX * ratio);
    const top = Math.round(offsetY * ratio);
    const kx = (Math.round((offsetX + variant.width * scale) * ratio) - left) / variant.width;
    const ky = (Math.round((offsetY + variant.height * scale) * ratio) - top) / variant.height;
    const [x, y, w, h] = variant.frames[frame - 1].box;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(images[frame - 1], left + x * kx, top + y * ky, w * kx, h * ky);
    layer.classList.add("is-turning");
    layer.dataset.frame = String(frame);
  }

  // The eye's position on screen, through the same cover fit and scroll-linked
  // push as the photograph (the canvas carries that transform).
  function eyeOnScreen(name, variant, chin = false) {
    const box = getComputedStyle(canvas);
    const width = parseFloat(box.width);
    const height = parseFloat(box.height);
    const scale = Math.max(width / variant.width, height / variant.height);
    const py = parseFloat(getComputedStyle(photo).objectPosition.split(" ")[1]) / 100;
    const layoutY = (height - variant.height * scale) * py + (chin ? CHINS[name] : EYES[name][1]) * scale;
    const drawn = canvas.getBoundingClientRect();
    return drawn.top + (layoutY / height) * drawn.height;
  }

  // 0 while the hero rests (and just after), 1 as his eye reaches the top.
  function turnAt(name, variant) {
    const eye = eyeOnScreen(name, variant);
    layer.dataset.eye = eye.toFixed(1);
    // The eye's height on screen at the moment the chin clears the bottom edge
    // (the two move together, so their distance holds).
    const chin = eyeOnScreen(name, variant, true);
    layer.dataset.chin = chin.toFixed(1);
    const start = eye + (1 - TURN_START) * window.innerHeight - chin;
    const header = document.querySelector(".site-header")?.getBoundingClientRect();
    const top = header && header.bottom > 0 && header.bottom < window.innerHeight * 0.3 ? header.bottom : 0;
    const end = top + TURN_END * window.innerHeight;
    if (start <= end) return eye <= end ? 1 : 0;
    return Math.min(1, Math.max(0, (start - eye) / (start - end)));
  }

  function schedule() {
    if (!framePending) {
      framePending = true;
      window.requestAnimationFrame(paint);
    }
  }

  // Fetch the frames once the photograph is in, without delaying it. The
  // <picture> fires load again when it switches source at the breakpoint.
  const begin = () => {
    if (motion.matches) return;
    const idle = window.requestIdleCallback || ((callback) => window.setTimeout(callback, 200));
    idle(() => load(variantName()));
    shown = -1;
    schedule();
  };
  if (photo.complete && photo.naturalWidth) begin();
  photo.addEventListener("load", begin);

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule, { passive: true });
  motion.addEventListener("change", () => {
    begin();
    schedule();
  });
  schedule();
}
