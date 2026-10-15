import { STATUE_COUNT, scrollPoint } from "./statues.js";

// The story's passages are not laid over the flight. Statues along the
// colonnade hold scrolls (baked into the video), and the camera flies to a
// hover in front of each one (camera.js). At each hover the frame holds for a
// stretch of scrolling (journey.js), and across that stretch the statue's
// papyrus flies out of his hands and unrolls, stays open to be read, then
// rolls up and returns as the flight carries on. It follows the scroll
// position alone, so wheel, trackpad, keys and auto-scroll all play it, and
// scrolling back plays it in reverse.
//
// The papyrus and its text are page markup and styles (journey.css), so they
// can change without rendering the flight again.

const NUMERALS = ["I", "II", "III", "IV", "V", "VI"];
const VIDEO = [1920, 1080]; // the flight's frame size, for finding the statue's scroll on screen
const OPENING = 0.22;       // share of a hold spent unrolling (and again rolling up)

const sub = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => {
  const length = Math.hypot(...a);
  return a.map((v) => v / length);
};
const clamp = (value) => Math.min(1, Math.max(0, value));
const easeOut = (k) => 1 - Math.pow(1 - k, 3);

export function setUpScrolls(journey, stage, beats, { scrollToRead }) {
  const passages = beats.slice(0, STATUE_COUNT);
  journey.classList.add("has-scrolls");

  // ---- markup: the dimmer, the papyrus, the list
  const layer = document.createElement("div");
  layer.className = "scroll-layer";
  layer.innerHTML = `
    <div class="scroll-dim" aria-hidden="true"></div>
    <div class="papyrus" role="region" aria-labelledby="papyrus-label" hidden>
      <div class="papyrus-sheet"><div class="papyrus-text">
        <p class="papyrus-label" id="papyrus-label"></p>
        <div class="papyrus-body"></div>
      </div></div>
      <div class="papyrus-roll papyrus-roll-top" aria-hidden="true"></div>
      <div class="papyrus-roll papyrus-roll-bottom" aria-hidden="true"></div>
    </div>
    <nav class="scroll-index" aria-label="Scrolls along the colonnade">
      <ol id="scroll-index-list" hidden></ol>
      <button class="scroll-index-toggle" type="button" aria-expanded="false" aria-controls="scroll-index-list">Scrolls · <span></span>/${passages.length} read</button>
    </nav>`;
  stage.append(layer);
  const dim = layer.querySelector(".scroll-dim");
  const papyrus = layer.querySelector(".papyrus");
  const sheet = layer.querySelector(".papyrus-sheet");
  const text = layer.querySelector(".papyrus-text");
  const label = layer.querySelector(".papyrus-label");
  const body = layer.querySelector(".papyrus-body");
  const rollTop = layer.querySelector(".papyrus-roll-top");
  const rollBottom = layer.querySelector(".papyrus-roll-bottom");
  const list = layer.querySelector("ol");
  const toggle = layer.querySelector(".scroll-index-toggle");
  const read = passages.map(() => false);

  passages.forEach((passage, i) => {
    const item = document.createElement("li");
    item.innerHTML = `<button type="button"><span class="scroll-index-number">${NUMERALS[i]}</span><span>${passage.label}</span><span class="scroll-index-read">read</span></button>`;
    item.querySelector("button").addEventListener("click", () => {
      list.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
      window.scrollTo({ top: scrollToRead(i), behavior: "smooth" });
    });
    list.append(item);
  });
  toggle.addEventListener("click", () => {
    list.hidden = !list.hidden;
    toggle.setAttribute("aria-expanded", String(!list.hidden));
  });
  function refresh() {
    toggle.querySelector("span").textContent = read.filter(Boolean).length;
    [...list.children].forEach((item, i) => item.classList.toggle("is-read", read[i]));
  }
  refresh();

  // where the statue's scroll is in the frame on screen: the frame's own
  // camera and field of view, mirrored and cropped like object-fit: cover
  function screenPoint(index, camera) {
    const [vw, vh] = VIDEO;
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    const degrees = Math.PI / 180;
    const fov = Math.min(75 * degrees, Math.max(camera.fov * degrees, 2 * Math.atan(Math.tan(25 * degrees) / (vw / vh))));
    const focal = 0.5 / Math.tan(fov / 2);
    const forward = norm(sub(camera.target, camera.position));
    const right = norm(cross([0, 1, 0], forward));
    const up = cross(forward, right);
    const scale = Math.max(width / vw, height / vh);
    const d = sub(scrollPoint(index), camera.position);
    const depth = dot(d, forward);
    return {
      x: (width - vw * scale) / 2 + (vw - (vw / 2 + (dot(d, right) / depth) * focal * vh)) * scale,
      y: (height - vh * scale) / 2 + (vh / 2 - (dot(d, up) / depth) * focal * vh) * scale,
    };
  }

  let shown = -1;
  function fill(index) {
    const copy = passages[index].element.cloneNode(true);
    // the copy must not repeat the page's ids or count as a beat
    for (const element of [copy, ...copy.querySelectorAll("[id]")]) element.removeAttribute("id");
    for (const name of ["aria-labelledby", "data-beat", "data-reading-beat", "data-label"]) copy.removeAttribute(name);
    copy.className = "papyrus-passage";
    copy.style.cssText = "";
    body.replaceChildren(copy);
    label.textContent = `Scroll ${NUMERALS[index]} · ${passages[index].label}`;
    shown = index;
  }

  // Every frame: how far the papyrus is open follows the scroll through the
  // hold. Opening: it flies out of the statue's hands (rolled up), then the
  // rollers part and the sheet unrolls; the words fade in last.
  function update(story, camera) {
    if (story.visit === null || story.visit >= passages.length) {
      papyrus.hidden = true;
      dim.style.opacity = "0";
      return;
    }
    const local = story.local;
    const open = local < OPENING ? local / OPENING : local > 1 - OPENING ? (1 - local) / OPENING : 1;
    if (shown !== story.visit) fill(story.visit);
    papyrus.hidden = open <= 0;
    if (open >= 1 && !read[story.visit]) {
      read[story.visit] = true;
      refresh();
    }
    const fly = easeOut(clamp(open / 0.4));
    const unroll = easeOut(clamp((open - 0.3) / 0.6));
    const words = clamp((open - 0.82) / 0.18);
    const point = screenPoint(story.visit, camera);
    const dx = (point.x - stage.clientWidth / 2) * (1 - fly);
    const centre = papyrus.offsetTop + papyrus.offsetHeight / 2; // below the header, not the stage's middle
    const dy = (point.y - centre) * (1 - fly);
    papyrus.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${(0.16 + 0.84 * fly).toFixed(4)})`;
    papyrus.style.opacity = (0.4 + 0.6 * fly).toFixed(3);
    const half = papyrus.clientHeight / 2 - 20; // the rollers are 40px tall
    const inset = (50 * (1 - unroll)).toFixed(2);
    sheet.style.clipPath = `inset(${inset}% 0 ${inset}% 0)`;
    rollTop.style.transform = `translateY(${(half * (1 - unroll)).toFixed(1)}px)`;
    rollBottom.style.transform = `translateY(${(-half * (1 - unroll)).toFixed(1)}px)`;
    text.style.opacity = words.toFixed(3);
    text.style.transform = `translateY(${(8 * (1 - words)).toFixed(1)}px)`;
    papyrus.toggleAttribute("aria-hidden", words < 0.5);
    dim.style.opacity = fly.toFixed(3);
  }

  return { update };
}
