import "./intro.css";
import { paintLight, LIGHT_WIDTH, LIGHT_HEIGHT, FOCUS } from "./grace.js";

// Opening sequence: the garden loops untouched at the top of the page. As the
// visitor scrolls, a grace-like light forms on the statue's head and then
// opens into rays that widen until the screen is white; scrolling back up
// reverses it. The white then lifts off the hero like mist. Reduced motion
// skips it entirely.

const SOURCE_WIDTH = 1920;
const SOURCE_HEIGHT = 1080;
const LIGHT_START = 0.01; // share of the intro's scroll where the light appears
const LIGHT_END = 0.84; // ...and where the screen is fully white
const ART_WIDTH = 1208; // the garden art's own pixels across the frame
const WALL = { x: 0.31, y: 0.495 }; // top left of the bare wall beside the statue

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
  const copy = intro.querySelector("[data-intro-copy]");
  const context = canvas.getContext("2d");
  const html = document.documentElement;

  const light = document.createElement("canvas");
  light.width = LIGHT_WIDTH;
  light.height = LIGHT_HEIGHT;
  const lightContext = light.getContext("2d");
  let layout = null;
  let lastKey = "";
  let framePending = false;
  let lightTimer = 0;
  let visible = true;

  // Cover the stage, but keep the statue's head in view on tall phones.
  function measure() {
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    const scale = Math.max(width / SOURCE_WIDTH, height / SOURCE_HEIGHT);
    const coverWidth = SOURCE_WIDTH * scale;
    const coverHeight = SOURCE_HEIGHT * scale;
    const x = clamp(width * 0.55 - FOCUS.x * coverWidth, width - coverWidth, 0);
    const y = clamp(height * 0.32 - FOCUS.y * coverHeight, height - coverHeight, 0);
    return { width, height, coverWidth, coverHeight, x, y };
  }

  function place(element) {
    if (!element) return;
    element.style.width = `${layout.coverWidth}px`;
    element.style.height = `${layout.coverHeight}px`;
    element.style.left = `${layout.x}px`;
    element.style.top = `${layout.y}px`;
  }

  // Letter the welcome onto the bare wall, sized in the art's own pixels.
  // Portrait screens crop the wall away, so there it sits low on the left.
  function placeCopy() {
    if (!copy) return;
    const { width, height, coverWidth, coverHeight, x, y } = layout;
    const portrait = width / height < 1.1;
    copy.classList.toggle("is-portrait", portrait);
    const unit = portrait
      ? clamp(width / 400, 0.8, 1.3)
      : Math.min(coverWidth / ART_WIDTH, height / 640);
    copy.style.setProperty("--u", unit.toFixed(3));
    copy.style.setProperty("--px", `${Math.max(1, Math.round(unit))}px`);
    const copyWidth = copy.offsetWidth;
    const copyHeight = copy.offsetHeight;
    const edge = Math.min(48, width * 0.06);
    const left = portrait ? edge : x + WALL.x * coverWidth;
    const top = portrait ? height - 150 - copyHeight : y + WALL.y * coverHeight;
    copy.style.setProperty("--copy-x", `${Math.round(clamp(left, edge, width - edge - copyWidth))}px`);
    copy.style.setProperty("--copy-y", `${Math.round(clamp(top, 70, height - 110 - copyHeight))}px`);
  }

  function resize() {
    if (motionPreference.matches) return;
    layout = measure();
    place(video);
    place(poster);
    placeCopy();
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
    if (!video || !video.paused || motionPreference.matches || document.hidden || !visible) return;
    video.muted = true;
    video.play()?.catch(() => {});
  }

  function paint(now = performance.now()) {
    framePending = false;
    window.clearTimeout(lightTimer);
    if (motionPreference.matches || !layout) {
      html.classList.remove("is-intro");
      return;
    }
    const rect = intro.getBoundingClientRect();
    const distance = Math.max(1, rect.height - window.innerHeight);
    const scrolled = clamp(-rect.top / distance);
    const t = clamp((scrolled - LIGHT_START) / (LIGHT_END - LIGHT_START));
    // Twenty-four discrete poses per second keep the flicker in the same
    // illustrated world as the loop. Scrolling itself is still immediate.
    const tick = Math.floor(now / (1000 / 24));

    // The site's header returns once the hero starts rising out of the white.
    html.classList.toggle("is-intro", rect.bottom > window.innerHeight * 0.15);
    intro.classList.toggle("is-scrolling", scrolled > 0.015);
    intro.classList.toggle("is-bright", t > 0.75);

    const animating = visible && !document.hidden && t > 0 && t < 1;
    if (animating) lightTimer = window.setTimeout(schedule, 1000 / 24);
    const key = `${t.toFixed(4)}|${animating ? tick : 0}|${layout.width}x${layout.height}`;
    if (key === lastKey) return;
    lastKey = key;

    // the garden brightens steadily as the rays spread
    lift.style.opacity = String(clamp((t - 0.25) / 0.75) * 0.6);
    context.clearRect(0, 0, layout.width, layout.height);

    if (t >= 1) {
      context.fillStyle = "#fff";
      context.fillRect(0, 0, layout.width, layout.height);
      video?.pause();
      return;
    }
    if (visible) playLoop();
    if (t <= 0 || !visible || document.hidden) return;
    paintLight(lightContext, t, tick / 24);
    context.drawImage(
      light,
      0,
      0,
      LIGHT_WIDTH,
      LIGHT_HEIGHT,
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
        visible = entry.isIntersecting;
        if (!visible) {
          video.pause();
          window.clearTimeout(lightTimer);
        } else {
          lastKey = "";
          schedule();
        }
      }
    }).observe(stage);
  }

  motionPreference.addEventListener("change", () => {
    if (motionPreference.matches) {
      video?.pause();
      window.clearTimeout(lightTimer);
      html.classList.remove("is-intro");
    }
    resize();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      video?.pause();
      window.clearTimeout(lightTimer);
    } else {
      lastKey = "";
      schedule();
    }
  });
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", resize, { passive: true });
  document.fonts?.ready.then(() => layout && placeCopy());

  resize();
}
