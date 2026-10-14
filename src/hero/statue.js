import "./statue.css";
import { STATUE_FRAMES } from "./statue-frames.js";

// Ares lowers his gaze as the visitor scrolls: first his eyes come level and
// his head stirs, then he bows his head toward the colonnade below. The hero
// holds still for that stretch (`.hero-hold-space`). Frame 0 is the photograph
// itself: no overlay is drawn, so the opening pose is the untouched image.
// Each later frame is a pre-rendered patch of the photograph (the head moved
// rigidly, the neck bent, the columns behind rebuilt), drawn on a canvas that
// shares the photograph's box and transform.

const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
const hold = document.querySelector("[data-statue-hold]");
const canvas = hold?.querySelector("[data-statue-canvas]");
const photo = hold?.querySelector("img[data-film-image]");

if (hold && canvas && photo && Object.keys(STATUE_FRAMES).length) setUpTurn();

function setUpTurn() {
  const layer = canvas.parentElement;
  const space = hold.querySelector(".hero-hold-space");
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
    shown = 0;
  }

  function paint() {
    framePending = false;
    if (motion.matches) return hide();
    const name = variantName();
    const variant = STATUE_FRAMES[name];
    const images = loaded.get(name);
    if (!variant || !images) return hide();
    const rect = hold.getBoundingClientRect();
    const t = Math.min(1, Math.max(0, -rect.top / Math.max(1, space.offsetHeight)));
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
