import "./intro.css";
import meta from "./intro.json";
import lightSheetUrl from "./light-sheet.png";

// Opening sequence: the pixel-art garden loops on its own, and scrolling grows a
// light from the statue's head until the screen is white. The white then lifts
// off the hero like mist. Reduced motion skips the sequence entirely.

const SOURCE_WIDTH = 1920;
const SOURCE_HEIGHT = 1080;
const LIGHT_START = 0.03; // share of the intro's scroll where the light appears
const LIGHT_END = 0.86; // ...and where the screen is fully white

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
const root = document.querySelector("[data-intro]");

export function introEnd() {
  if (!root || motionPreference.matches) return 0;
  return root.offsetTop + root.offsetHeight;
}

if (root) setUpIntro(root);

function setUpIntro(intro) {
  const stage = intro.querySelector("[data-intro-stage]");
  const video = intro.querySelector("[data-intro-video]");
  const poster = intro.querySelector("[data-intro-poster]");
  const lift = intro.querySelector("[data-intro-lift]");
  const canvas = intro.querySelector("[data-intro-light]");
  const skip = intro.querySelector("[data-intro-skip]");
  const context = canvas.getContext("2d");
  const html = document.documentElement;

  let sheet = null;
  let layout = null;
  let lastKey = "";
  let framePending = false;

  // Cover the stage, but keep the statue's head in view on tall phones.
  function measure() {
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    const scale = Math.max(width / SOURCE_WIDTH, height / SOURCE_HEIGHT);
    const coverWidth = SOURCE_WIDTH * scale;
    const coverHeight = SOURCE_HEIGHT * scale;
    const x = clamp(width * 0.55 - meta.focusX * coverWidth, width - coverWidth, 0);
    const y = clamp(height * 0.32 - meta.focusY * coverHeight, height - coverHeight, 0);
    return { width, height, coverWidth, coverHeight, x, y };
  }

  function place(element) {
    if (!element) return;
    element.style.width = `${layout.coverWidth}px`;
    element.style.height = `${layout.coverHeight}px`;
    element.style.left = `${layout.x}px`;
    element.style.top = `${layout.y}px`;
  }

  function resize() {
    if (motionPreference.matches) return;
    layout = measure();
    place(video);
    place(poster);
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(layout.width * ratio);
    canvas.height = Math.round(layout.height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.imageSmoothingEnabled = false;
    lastKey = "";
    paint();
  }

  // The loop is not marked autoplay, so reduced-motion visitors never download it.
  function playLoop() {
    if (!video || !video.paused || motionPreference.matches) return;
    video.muted = true;
    video.play()?.catch(() => {});
  }

  function paint() {
    framePending = false;
    if (motionPreference.matches || !layout) {
      html.classList.remove("is-intro");
      return;
    }
    const rect = intro.getBoundingClientRect();
    const distance = Math.max(1, rect.height - window.innerHeight);
    const scrolled = clamp(-rect.top / distance);
    const t = clamp((scrolled - LIGHT_START) / (LIGHT_END - LIGHT_START));
    const frame = t <= 0 ? -1 : Math.min(meta.frames - 1, Math.floor(t * meta.frames));

    // The site's header returns once the hero starts rising out of the white.
    html.classList.toggle("is-intro", rect.bottom > window.innerHeight * 0.15);
    intro.classList.toggle("is-scrolling", scrolled > 0.015);
    intro.classList.toggle("is-bright", t > 0.6);

    const key = `${frame}|${layout.width}x${layout.height}`;
    if (key === lastKey) return;
    lastKey = key;

    lift.style.opacity = frame < 0 ? "0" : String(meta.lift[frame]);
    context.clearRect(0, 0, layout.width, layout.height);

    if (frame >= meta.frames - 1) {
      context.fillStyle = "#fff";
      context.fillRect(0, 0, layout.width, layout.height);
      video?.pause();
      return;
    }
    if (rect.bottom > 0) playLoop();
    if (frame < 0 || !sheet) return;
    const column = frame % meta.cols;
    const row = Math.floor(frame / meta.cols);
    context.drawImage(
      sheet,
      column * meta.width,
      row * meta.height,
      meta.width,
      meta.height,
      layout.x,
      layout.y,
      layout.coverWidth,
      layout.coverHeight,
    );
  }

  function schedule() {
    if (!framePending) {
      framePending = true;
      window.requestAnimationFrame(paint);
    }
  }

  skip?.addEventListener("click", () => {
    const hero = document.querySelector("#home");
    window.scrollTo({ top: introEnd(), behavior: "smooth" });
    hero?.setAttribute("tabindex", "-1");
    hero?.focus({ preventScroll: true });
    hero?.addEventListener("blur", () => hero.removeAttribute("tabindex"), {
      once: true,
    });
  });

  // Stop decoding the loop whenever the intro is out of view.
  if ("IntersectionObserver" in window && video) {
    new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) video.pause();
        else schedule();
      }
    }).observe(stage);
  }

  const image = new Image();
  image.decoding = "async";
  image.addEventListener("load", () => {
    sheet = image;
    lastKey = "";
    schedule();
  });
  const loadSheet = () => {
    if (!motionPreference.matches && !image.src) image.src = lightSheetUrl;
  };

  motionPreference.addEventListener("change", () => {
    if (motionPreference.matches) video?.pause();
    loadSheet();
    resize();
  });
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", resize, { passive: true });

  loadSheet();
  resize();
}
