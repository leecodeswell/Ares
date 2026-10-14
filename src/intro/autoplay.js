// The intro plays itself, once. The visitor's first scroll brings out the
// grace; their second sets the page gliding on its own through the rays and
// the white, stopping just as the top of the hero peeks in at the bottom of
// the screen. While it glides, scrolling up hands control straight back and
// scrolling down hurries it along. After that (or if they cancel) the intro
// simply follows the scroll, both ways, as before.
//
// Nothing here ever holds the page: upward input, Tab, Escape, the Skip
// button or any touch that drags back up stop the glide immediately, and
// reduced-motion visitors never get it at all.

const SPEED = 0.17; // viewport heights per second: a slow, even glide
const EASE_IN = 0.7; // seconds to come up to speed
const EASE_OUT = 0.16; // share of a viewport over which it settles to a stop
const PEEK = 0.14; // how much of the hero shows when it stops (it rises through the white mist)
const GESTURE_GAP = 220; // ms of quiet that separates one wheel gesture from the next
const MAX_BOOST = 3.5;

const FORWARD_KEYS = new Set(["ArrowDown", "PageDown", " ", "Spacebar"]);
const BACK_KEYS = new Set(["ArrowUp", "PageUp", "Home"]);

export function setUpAutoplay({ intro, skip, motionPreference }) {
  // "first scroll" -> "armed" (waiting for the second) -> "playing" -> "done"
  let state = "first";
  let gestures = 0;
  let lastWheel = 0;
  let position = 0;
  let boost = 1;
  let started = 0;
  let lastFrame = 0;
  let frame = 0;
  let held = false;
  let touchStartY = 0;
  let touchStartScroll = 0;
  let lastY = window.scrollY;

  const html = document.documentElement;
  const target = () => intro.offsetTop + intro.offsetHeight - window.innerHeight * (1 - PEEK);

  // A page restored mid-way down, or with no room to glide, never auto-plays.
  if (motionPreference.matches || window.scrollY > 4 || target() <= 0) state = "done";
  intro.dataset.autoplay = state;

  function setState(next) {
    state = next;
    intro.dataset.autoplay = next;
  }

  function stop() {
    if (state === "done") return;
    window.cancelAnimationFrame(frame);
    html.classList.remove("is-autoplaying");
    setState("done");
  }

  function begin() {
    if (motionPreference.matches || window.scrollY >= target() - 2) return stop();
    setState("playing");
    html.classList.add("is-autoplaying");
    position = window.scrollY;
    started = performance.now();
    lastFrame = started;
    frame = window.requestAnimationFrame(step);
  }

  function step(now) {
    if (state !== "playing") return;
    const dt = Math.min(0.1, (now - lastFrame) / 1000);
    lastFrame = now;
    const end = target();
    if (held) {
      // A finger is on the screen: follow it rather than fight it.
      position = window.scrollY;
    } else {
      // Anyone who has scrolled back up past the glide has taken over.
      if (window.scrollY < position - 3) return stop();
      position = Math.max(position, window.scrollY);
      const rampIn = Math.min(1, (now - started) / 1000 / EASE_IN);
      const remaining = end - position;
      // constant deceleration over the last stretch, like a cart rolling to rest
      const settle = Math.sqrt(Math.min(1, Math.max(0, remaining) / (window.innerHeight * EASE_OUT)));
      const speed = SPEED * window.innerHeight * boost * (rampIn * rampIn * (3 - 2 * rampIn));
      position = Math.min(end, position + speed * dt * Math.max(0.06, settle));
      window.scrollTo({ top: position, behavior: "instant" });
    }
    if (position >= end - 0.5) return stop();
    frame = window.requestAnimationFrame(step);
  }

  function hurry(amount) {
    boost = Math.min(MAX_BOOST, boost + amount);
  }

  // One wheel gesture is a burst of events (a notch, or a trackpad swipe and
  // its inertia); the second downward burst starts the glide.
  function countGesture() {
    gestures += 1;
    if (gestures === 1) setState("armed");
    else begin();
  }

  window.addEventListener(
    "wheel",
    (event) => {
      if (state === "done") return;
      const now = performance.now();
      const fresh = now - lastWheel > GESTURE_GAP;
      lastWheel = now;
      if (event.deltaY < 0) {
        if (state === "playing") stop();
        return;
      }
      if (event.deltaY === 0 || event.ctrlKey) return;
      if (state === "playing") {
        // Scrolling down while it plays speeds it up instead of jerking ahead.
        event.preventDefault();
        if (fresh) hurry(0.6);
        else hurry(Math.min(0.25, event.deltaY / window.innerHeight));
        return;
      }
      if (fresh) countGesture();
      if (state === "playing") event.preventDefault();
    },
    { passive: false },
  );

  window.addEventListener("keydown", (event) => {
    if (state === "done" || event.altKey || event.ctrlKey || event.metaKey) return;
    const forward = FORWARD_KEYS.has(event.key) && !event.shiftKey;
    const onControl = event.target instanceof HTMLElement && event.target.closest("button, a, input, textarea, select");
    if (state === "playing") {
      if (forward && !(onControl && event.key === " ")) {
        event.preventDefault();
        hurry(0.6);
      } else if (!["Shift", "Control", "Alt", "Meta"].includes(event.key)) {
        // Anything else (Tab, Escape, arrows up) belongs to the visitor.
        stop();
      }
      return;
    }
    if (forward && !onControl) countGesture();
    else if (BACK_KEYS.has(event.key) && state === "armed") gestures = 1;
  });

  window.addEventListener(
    "touchstart",
    (event) => {
      if (state === "done") return;
      held = true;
      touchStartY = event.touches[0]?.clientY ?? 0;
      touchStartScroll = window.scrollY;
    },
    { passive: true },
  );
  window.addEventListener(
    "touchend",
    (event) => {
      if (state === "done") return;
      held = false;
      const endY = event.changedTouches[0]?.clientY ?? touchStartY;
      const swipe = touchStartY - endY; // positive: the page was pushed down
      if (state === "playing") {
        if (swipe < -8 || window.scrollY < touchStartScroll - 3) stop();
        else if (swipe > 8) {
          hurry(0.6);
          position = window.scrollY;
        }
        return;
      }
      if (swipe > 8) countGesture();
    },
    { passive: true },
  );
  window.addEventListener("touchcancel", () => {
    held = false;
  });

  // Reaching the hero any other way (scrollbar, a link) also ends it.
  window.addEventListener(
    "scroll",
    () => {
      const y = window.scrollY;
      const risen = y < lastY;
      lastY = y;
      if (state === "done" || state === "playing") return;
      if (y >= target() - 2) stop();
      // Scrolled back up to the very top, the light is gone, so the count
      // starts over.
      else if (state === "armed" && risen && y <= 1) {
        gestures = 0;
        setState("first");
      }
    },
    { passive: true },
  );

  skip?.addEventListener("click", stop, { capture: true });
  motionPreference.addEventListener("change", () => {
    if (motionPreference.matches) stop();
  });

  return { stop, state: () => state };
}
