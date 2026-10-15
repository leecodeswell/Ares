import "./journey.css";
import { cameraAt } from "./camera.js";
import { setUpScrolls } from "./scrolls.js";

// The journey: a camera flies up the steps and down a static marble
// colonnade, through the arch in its far wall and out into open sky, past
// statues that hold out scrolls; the camera hovers at each, and its scroll
// opens one of the story's passages (scrolls.js). The flight is rendered offline at full
// quality along a fixed path (tools/render-journey) and played here as a
// video scrubbed by the scroll, so the visitor's GPU does no 3D work.

const BEAT_FADE = 0.18;
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const smooth = (edge0, edge1, value) => {
  const x = clamp((value - edge0) / (edge1 - edge0));
  return x * x * (3 - 2 * x);
};

const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
// The journey is desktop-only for now: on phones the section is hidden
// (journey.css) and links to it lead on to the showcase instead.
const phone = window.matchMedia("(max-width: 760px)");
function routeVisionLinks() {
  for (const link of document.querySelectorAll('a[href="#vision"], a[data-vision-link]')) {
    link.dataset.visionLink = "";
    link.setAttribute("href", phone.matches ? "#showcase" : "#vision");
  }
}
routeVisionLinks();
phone.addEventListener("change", routeVisionLinks);
const root = document.querySelector("[data-journey]");
if (root) setUpJourney(root);

function setUpJourney(journey) {
  const stage = journey.querySelector("[data-journey-stage]");
  const video = journey.querySelector("[data-journey-video]");
  const still = journey.querySelector("[data-journey-still]");
  const frames = Number(video?.dataset.frames) || 240;
  const fps = Number(video?.dataset.fps) || 24;
  // For each orientation, the first encoding this browser can decode
  // (H.264 where available, VP9 WebM otherwise).
  const sources = {};
  for (const source of video?.querySelectorAll("source") || []) {
    const { orientation: shape } = source.dataset;
    if (!sources[shape] && video.canPlayType(source.type)) sources[shape] = source.src;
  }
  const beats = [...journey.querySelectorAll("[data-beat]")].map((element) => {
    const [start, end] = element.dataset.beat.split(" ").map(Number);
    return {
      element,
      start,
      end,
      reading: element.hasAttribute("data-reading-beat"),
      links: [...element.querySelectorAll("a")],
      label: element.dataset.label || "",
    };
  });
  // With motion, the passages live on the statues' scrolls; with reduced
  // motion there is no flight, and they read as one section over the still.
  const scrolls = setUpScrolls(journey, stage, beats, { cameraAt, reduced: () => motionPreference.matches });
  const readingBeat = beats.find((beat) => beat.reading);
  const journeyStyle = getComputedStyle(journey);
  const flightScroll = Number.parseFloat(journeyStyle.getPropertyValue("--flight-scroll"));
  const readingScroll = Number.parseFloat(journeyStyle.getPropertyValue("--reading-scroll"));

  // Stretch only the qualities' fully opaque interval. The camera keeps moving
  // gently behind the words, and every other beat retains its original runway.
  function storyAt(scrollProgress) {
    if (!readingBeat || !flightScroll || !readingScroll) return scrollProgress;
    const span = readingBeat.end - readingBeat.start;
    const start = readingBeat.start + span * BEAT_FADE;
    const end = readingBeat.end - span * BEAT_FADE;
    const distance = scrollProgress * (flightScroll + readingScroll);
    const readingStart = start * flightScroll;
    const readingEnd = end * flightScroll + readingScroll;
    if (distance <= readingStart) return distance / flightScroll;
    if (distance >= readingEnd) return (distance - readingScroll) / flightScroll;
    return start + ((distance - readingStart) / (readingEnd - readingStart)) * (end - start);
  }

  let progress = 0;
  let framePending = false;
  let ready = false;
  let orientation = "";
  let seeking = false;
  let wantedFrame = -1;
  let shownFrame = -1;

  function measure() {
    const rect = journey.getBoundingClientRect();
    const distance = Math.max(1, rect.height - window.innerHeight);
    return storyAt(clamp(-rect.top / distance));
  }

  // Each beat fades in, travels up the screen with the scroll as the camera
  // moves, and fades out before the next arrives. The words float over the
  // scene with only a soft glow behind their letters for legibility.
  // The tablets ride past like a slow carousel: each comes in from the left,
  // turns to face the visitor as it crosses the centre, and turns away again
  // as it leaves on the right, while the next is already coming in behind it.
  // Nothing fades; they simply move in and out of view.
  function placeBeats() {
    const width = window.innerWidth;
    const narrow = width <= 760;
    // screen distance between neighbouring tablets
    // far enough apart that at most two are ever on screen together
    const spacing = narrow ? width * 1.15 : width * 0.95;
    const centres = beats.map((beat) => (beat.start + beat.end) / 2);
    const step = centres.length > 1 ? (centres[centres.length - 1] - centres[0]) / (centres.length - 1) : 1;
    beats.forEach((beat, index) => {
      const span = beat.end - beat.start;
      const local = (progress - beat.start) / span;
      // -1 one place left, +1 one place right; the first passage is already
      // waiting in the centre when the flight begins
      const raw = (progress - centres[index]) / step;
      const offset = index === 0 ? Math.max(0, raw) : raw;
      const x = motionPreference.matches ? 0 : offset * spacing;
      const turn = motionPreference.matches ? 0 : clamp(offset, -1.5, 1.5) * -32;
      const box = beat.element.offsetWidth;
      beat.element.style.opacity = "1";
      beat.element.style.setProperty("--beat-turn", `${turn.toFixed(2)}deg`);
      // lines part away from the centre and close as the passage crosses it
      beat.element.style.setProperty("--beat-offset", motionPreference.matches ? "0" : clamp(offset, -1.5, 1.5).toFixed(4));
      beat.element.style.setProperty("--beat-progress", clamp(local).toFixed(4));
      beat.element.style.setProperty("--beat-x", `${x.toFixed(1)}px`);
      // Every beat stays readable to screen readers; only links that can't be
      // seen leave the tab order.
      const shown = motionPreference.matches || Math.abs(x) < width / 2 + box / 2;
      beat.element.classList.toggle("is-shown", shown);
      for (const link of beat.links) {
        if (shown) link.removeAttribute("tabindex");
        else link.setAttribute("tabindex", "-1");
      }
    });
  }

    function pickSource() {
    if (!video) return;
    // only the landscape flight is rendered; a portrait one is used if present
    const wanted = sources.portrait && stage.clientHeight > stage.clientWidth * 1.05 ? "portrait" : "landscape";
    if (wanted === orientation || !sources[wanted]) return;
    orientation = wanted;
    ready = false;
    journey.classList.remove("is-flying");
    // Once the journey is near, fetch the whole flight so every frame is
    // ready to seek to.
    video.preload = "auto";
    video.src = sources[wanted];
    video.load();
  }

  // Seek one frame at a time: a new seek waits for the last to land, so fast
  // scrolling never queues up stale frames. Frames are tracked by index, not
  // by currentTime, which browsers may report snapped to the frame's start.
  function seekTo(frame) {
    wantedFrame = frame;
    if (!ready || seeking || frame === shownFrame) return;
    seeking = true;
    shownFrame = frame;
    // aim for the middle of the frame so rounding never lands on a neighbour
    video.currentTime = (frame + 0.5) / fps;
  }

  function draw() {
    framePending = false;
    progress = motionPreference.matches ? 0 : measure();
    if (motionPreference.matches) placeBeats();
    journey.dataset.progress = progress.toFixed(3);
    // markers follow the frame on screen, so they never drift from the picture
    const camera = cameraAt(ready ? Math.round(progress * (frames - 1)) / (frames - 1) : progress);
    scrolls.place();

    if (!ready) {
      if (still) {
        // Until the flight has loaded, its first frame pushes gently toward
        // the arch so the scroll never feels dead.
        still.style.transform = `scale(${(1 + 0.6 * smooth(0, 1, camera.flight)).toFixed(4)})`;
        still.style.opacity = String(1 - camera.paper);
      }
      return;
    }
    seekTo(Math.round(progress * (frames - 1)));
  }

  function schedule() {
    if (!framePending) {
      framePending = true;
      window.requestAnimationFrame(draw);
    }
  }

  if (video) {
    video.muted = true;
    video.addEventListener("loadeddata", () => {
      ready = true;
      seeking = false;
      shownFrame = -1;
      journey.classList.add("is-flying");
      if (still) still.style.transform = "";
      schedule();
    });
    // Some mobile browsers hold back a video's frames until it has played;
    // a muted inline video may, so nudge it once and stop at once.
    video.addEventListener("loadedmetadata", () => {
      window.setTimeout(() => {
        if (video.readyState >= 2) return;
        video
          .play()
          ?.then(() => {
            video.pause();
            shownFrame = -1; // put the right frame back after the nudge
            schedule();
          })
          .catch(() => {});
      }, 1500);
    });
    video.addEventListener("seeked", () => {
      seeking = false;
      if (wantedFrame >= 0 && wantedFrame !== shownFrame) seekTo(wantedFrame);
    });
    video.addEventListener("error", () => {
      ready = false;
      journey.classList.remove("is-flying");
    });
  }

  window.addEventListener("scroll", () => {
    if (!motionPreference.matches && !phone.matches) scrolls.onScroll();
    schedule();
  }, { passive: true });
  window.addEventListener("resize", () => {
    if (orientation) pickSource();
    schedule();
  }, { passive: true });
  motionPreference.addEventListener("change", () => {
    if (!motionPreference.matches && !orientation) pickSource();
    schedule();
  });

  // Start loading the flight well before the journey comes into view.
  if (motionPreference.matches) {
    placeBeats();
  } else if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          pickSource();
        }
      },
      { rootMargin: "150% 0px" },
    );
    observer.observe(journey);
    schedule();
  } else {
    pickSource();
  }
}
