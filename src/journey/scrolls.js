import { STATUE_COUNT, scrollPoint } from "./statues.js";
import { VISITS } from "./camera.js";

// The story's passages are not laid over the flight. Statues along the
// colonnade hold scrolls (baked into the video), and the camera flies to a
// hover in front of each one (camera.js). As the visitor scrolls near a
// statue the journey glides into that hover and holds; the next scroll
// unrolls a large papyrus with the passage, the one after rolls it up again
// and the flight carries on. One gesture moves one step, by wheel, swipe or
// key, and a list of every scroll keeps each passage one click away.
//
// The papyrus and its text are page markup and styles (journey.css), so they
// can change without rendering the flight again.

const NUMERALS = ["I", "II", "III", "IV", "V", "VI"];
const VIDEO = [1920, 1080]; // the flight's frame size, for placing the cue on the statue's scroll
const GLIDE_IN = 650;       // ms to glide into a hover
const GLIDE_OUT = 600;      // ms to glide on after the scroll rolls up
const GESTURE_GAP = 220;    // ms of quiet before wheel input counts as a new gesture

const sub = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => {
  const length = Math.hypot(...a);
  return a.map((v) => v / length);
};
const easeInOut = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);

export function setUpScrolls(journey, stage, beats, { cameraAt, reduced }) {
  const passages = beats.slice(0, STATUE_COUNT);
  const visits = VISITS.slice(0, passages.length);
  journey.classList.add("has-scrolls");
  const root = document.documentElement;

  // ---- markup: the dimmer, the cue on the statue's scroll, the papyrus, the hint, the list
  const layer = document.createElement("div");
  layer.className = "scroll-layer";
  layer.innerHTML = `
    <div class="scroll-dim" aria-hidden="true"></div>
    <button class="scroll-cue" type="button" hidden></button>
    <div class="papyrus" role="dialog" aria-modal="true" aria-labelledby="papyrus-label" hidden>
      <div class="papyrus-sheet"><div class="papyrus-text">
        <p class="papyrus-label" id="papyrus-label"></p>
        <div class="papyrus-body"></div>
      </div></div>
      <div class="papyrus-roll papyrus-roll-top" aria-hidden="true"></div>
      <div class="papyrus-roll papyrus-roll-bottom" aria-hidden="true"></div>
      <button class="papyrus-close" type="button" aria-label="Roll up the scroll">×</button>
    </div>
    <p class="scroll-hint" aria-live="polite"></p>
    <nav class="scroll-index" aria-label="Scrolls along the colonnade">
      <ol id="scroll-index-list" hidden></ol>
      <button class="scroll-index-toggle" type="button" aria-expanded="false" aria-controls="scroll-index-list">Scrolls · <span></span>/${passages.length} read</button>
    </nav>`;
  stage.append(layer);
  const dim = layer.querySelector(".scroll-dim");
  const cue = layer.querySelector(".scroll-cue");
  const papyrus = layer.querySelector(".papyrus");
  const sheet = layer.querySelector(".papyrus-sheet");
  const text = layer.querySelector(".papyrus-text");
  const label = layer.querySelector(".papyrus-label");
  const body = layer.querySelector(".papyrus-body");
  const rollTop = layer.querySelector(".papyrus-roll-top");
  const rollBottom = layer.querySelector(".papyrus-roll-bottom");
  const close = layer.querySelector(".papyrus-close");
  const hint = layer.querySelector(".scroll-hint");
  const list = layer.querySelector("ol");
  const toggle = layer.querySelector(".scroll-index-toggle");
  const read = passages.map(() => false);

  passages.forEach((passage, i) => {
    const item = document.createElement("li");
    item.innerHTML = `<button type="button"><span class="scroll-index-number">${NUMERALS[i]}</span><span>${passage.label}</span><span class="scroll-index-read">read</span></button>`;
    item.querySelector("button").addEventListener("click", () => jumpTo(i));
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

  // ---- the journey's scroll position
  const span = () => Math.max(1, journey.offsetHeight - window.innerHeight);
  const progressNow = () => Math.min(1, Math.max(0, (window.scrollY - journey.offsetTop) / span()));
  const scrollFor = (progress) => journey.offsetTop + progress * span();

  let mode = "free"; // free | approach | arrived | opening | open | closing | leave
  let visit = null;
  let lastProgress = progressNow();
  let busyUntil = 0;
  let glide = 0;
  let opener = null;
  const passed = new Set();

  function setLocked(locked) {
    root.classList.toggle("is-journey-held", locked);
  }
  function setHint(words) {
    hint.textContent = words;
    hint.classList.toggle("is-shown", Boolean(words));
  }
  function glideTo(progress, duration, done) {
    const from = window.scrollY;
    const to = scrollFor(progress);
    const started = performance.now();
    const id = ++glide;
    const step = (now) => {
      if (id !== glide) return;
      const k = duration > 0 ? Math.min(1, (now - started) / duration) : 1;
      window.scrollTo({ top: from + (to - from) * easeInOut(k), behavior: "instant" });
      if (k < 1) requestAnimationFrame(step);
      else done?.();
    };
    requestAnimationFrame(step);
  }

  function arrive(target) {
    visit = target;
    mode = "approach";
    setLocked(true);
    glideTo(target.hold, reduced() ? 0 : GLIDE_IN, () => {
      mode = "arrived";
      busyUntil = performance.now() + 450;
      setHint(`Scroll to open scroll ${NUMERALS[target.index]}`);
      place();
    });
  }
  function leave(direction) {
    const target = visit;
    passed.add(target.index);
    mode = "leave";
    setHint("");
    const to = direction > 0 ? target.end + 0.004 : target.start - 0.012;
    glideTo(to, reduced() ? 0 : GLIDE_OUT, () => {
      mode = "free";
      visit = null;
      setLocked(false);
      lastProgress = progressNow();
    });
  }

  // Called on every scroll: the first unread hover crossed on the way down
  // pulls the journey into it, however far one scroll jumped.
  function onScroll() {
    const progress = progressNow();
    if (mode === "free") {
      for (const v of visits) if (progress < v.start - 0.01) passed.delete(v.index);
      const crossed = visits.find((v) => !passed.has(v.index) && lastProgress < v.hold && progress >= v.start);
      if (crossed && progress > lastProgress) arrive(crossed);
    }
    lastProgress = progress;
  }

  // ---- one gesture, one step
  function step(direction) {
    if (performance.now() < busyUntil) return;
    if (mode === "arrived") {
      if (direction > 0) openScroll(visit.index);
      else leave(-1);
    } else if (mode === "open") rollUp(direction > 0);
  }
  let lastWheel = 0;
  window.addEventListener("wheel", (event) => {
    if (mode === "free") return;
    event.preventDefault();
    const now = performance.now();
    const gap = now - lastWheel;
    lastWheel = now;
    if (gap > GESTURE_GAP && Math.abs(event.deltaY) > 2) step(Math.sign(event.deltaY));
  }, { passive: false });
  let touchY = null;
  window.addEventListener("touchstart", (event) => {
    touchY = event.touches[0].clientY;
  }, { passive: true });
  window.addEventListener("touchmove", (event) => {
    if (mode === "free") return;
    event.preventDefault();
    const y = event.touches[0].clientY;
    if (touchY !== null && Math.abs(y - touchY) > 30) {
      step(touchY > y ? 1 : -1);
      touchY = null;
    }
  }, { passive: false });
  window.addEventListener("keydown", (event) => {
    if (mode === "free" || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "Escape" && mode === "open") {
      event.preventDefault();
      rollUp(false);
      return;
    }
    // Enter and Space still press a focused button or link
    if ((event.key === "Enter" || event.key === " ") && event.target.closest?.("button, a")) return;
    const down = ["ArrowDown", "PageDown", " ", "Enter"].includes(event.key);
    const up = ["ArrowUp", "PageUp"].includes(event.key);
    if (down || up) {
      event.preventDefault();
      step(down ? 1 : -1);
    }
  });

  // ---- the papyrus
  function screenPoint(index) {
    const camera = cameraAt(progressNow());
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
      // the video is mirrored, and cropped like object-fit: cover
      x: (width - vw * scale) / 2 + (vw - (vw / 2 + (dot(d, right) / depth) * focal * vh)) * scale,
      y: (height - vh * scale) / 2 + (vh / 2 - (dot(d, up) / depth) * focal * vh) * scale,
    };
  }
  function fromHands(index) {
    const point = screenPoint(index);
    return `translate(${(point.x - stage.clientWidth / 2).toFixed(1)}px, ${(point.y - stage.clientHeight / 2).toFixed(1)}px) scale(0.16)`;
  }
  function fill(index) {
    const copy = passages[index].element.cloneNode(true);
    // the copy must not repeat the page's ids or count as a beat
    for (const element of [copy, ...copy.querySelectorAll("[id]")]) element.removeAttribute("id");
    for (const name of ["aria-labelledby", "data-beat", "data-reading-beat", "data-label"]) copy.removeAttribute(name);
    copy.className = "papyrus-passage";
    copy.style.cssText = "";
    body.replaceChildren(copy);
    label.textContent = `Scroll ${NUMERALS[index]} · ${passages[index].label}`;
  }

  function openScroll(index) {
    mode = "opening";
    busyUntil = performance.now() + 1100;
    setHint("");
    opener = document.activeElement;
    read[index] = true;
    refresh();
    fill(index);
    papyrus.hidden = false;
    dim.classList.add("is-on");
    cue.hidden = true;
    const half = papyrus.clientHeight / 2 - 15;
    const pace = reduced() ? 0.01 : 1;
    const ease = "cubic-bezier(.2,.75,.25,1)";
    // out of the statue's hands, rolled up, then unrolled top and bottom
    papyrus.animate([{ transform: fromHands(index), opacity: 0.4 }, { transform: "none", opacity: 1 }], { duration: 380 * pace, easing: ease, fill: "both" });
    const unroll = { duration: 620 * pace, delay: 330 * pace, easing: ease, fill: "both" };
    sheet.animate([{ clipPath: "inset(50% 0 50% 0)" }, { clipPath: "inset(0 0 0 0)" }], unroll);
    rollTop.animate([{ transform: `translateY(${half}px)` }, { transform: "none" }], unroll);
    rollBottom.animate([{ transform: `translateY(${-half}px)` }, { transform: "none" }], unroll);
    text.animate([{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 300 * pace, delay: 780 * pace, fill: "both" });
    close.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200 * pace, delay: 800 * pace, fill: "both" }).finished.then(() => {
      mode = "open";
      busyUntil = performance.now() + 600;
      setHint("Scroll to roll it up and fly on");
      close.focus({ preventScroll: true });
    });
  }
  function rollUp(flyOn) {
    if (mode !== "open") return;
    mode = "closing";
    busyUntil = performance.now() + 900;
    setHint("");
    const index = visit.index;
    const half = papyrus.clientHeight / 2 - 15;
    const pace = reduced() ? 0.01 : 1;
    const ease = "cubic-bezier(.5,0,.75,.3)";
    text.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160 * pace, fill: "both" });
    close.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120 * pace, fill: "both" });
    const roll = { duration: 460 * pace, delay: 120 * pace, easing: ease, fill: "both" };
    sheet.animate([{ clipPath: "inset(0 0 0 0)" }, { clipPath: "inset(50% 0 50% 0)" }], roll);
    rollTop.animate([{ transform: "none" }, { transform: `translateY(${half}px)` }], roll);
    rollBottom.animate([{ transform: "none" }, { transform: `translateY(${-half}px)` }], roll);
    dim.classList.remove("is-on");
    papyrus.animate([{ transform: "none", opacity: 1 }, { transform: fromHands(index), opacity: 0 }], { duration: 320 * pace, delay: 560 * pace, easing: "cubic-bezier(.4,0,.2,1)", fill: "both" }).finished.then(() => {
      papyrus.hidden = true;
      for (const animation of papyrus.getAnimations({ subtree: true })) animation.cancel();
      if (opener?.focus && opener !== close && document.contains(opener)) opener.focus({ preventScroll: true });
      mode = "arrived";
      if (flyOn) leave(1);
      else {
        setHint(`Scroll to open scroll ${NUMERALS[index]}`);
        place();
      }
    });
  }
  close.addEventListener("click", () => rollUp(true));
  cue.addEventListener("click", () => {
    if (mode === "arrived") openScroll(visit.index);
  });
  papyrus.addEventListener("click", (event) => {
    // following a link in a passage rolls the scroll up first
    if (event.target.closest("a")) rollUp(false);
  });

  // the list flies straight to a statue and opens its scroll
  function jumpTo(index) {
    list.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    if (mode === "opening" || mode === "open" || mode === "closing") return;
    visit = visits[index];
    mode = "approach";
    setLocked(true);
    glideTo(visit.hold, reduced() ? 0 : 900, () => {
      mode = "arrived";
      openScroll(index);
    });
  }

  // every frame: keep the cue on the statue's scroll while the camera hovers
  // (also called on arriving, since a hover holds the frame and nothing else redraws)
  function place() {
    if (mode === "arrived" && visit) {
      const point = screenPoint(visit.index);
      cue.hidden = false;
      cue.textContent = NUMERALS[visit.index];
      cue.setAttribute("aria-label", `Open scroll ${NUMERALS[visit.index]}: ${passages[visit.index].label}`);
      cue.style.transform = `translate(${point.x.toFixed(1)}px, ${point.y.toFixed(1)}px) translate(-50%, -50%)`;
    } else if (mode !== "opening" && mode !== "open" && mode !== "closing") {
      cue.hidden = true;
    }
  }

  return { place, onScroll };
}
