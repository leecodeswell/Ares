import "./journey.css";
import { cameraAt } from "./camera.js";

// The journey: a camera flies up the steps and down a static marble
// colonnade, through the arch in its far wall and out into open sky, while
// the story's words arrive in step. The flight is rendered offline at full
// quality along a fixed path (tools/render-journey) and played here as a
// video scrubbed by the scroll, so the visitor's GPU does no 3D work.

const BEAT_FADE = 0.18;
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const smooth = (edge0, edge1, value) => {
  const x = clamp((value - edge0) / (edge1 - edge0));
  return x * x * (3 - 2 * x);
};

const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
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
    };
  });
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
  function placeBeats() {
    const travel = window.innerHeight * 0.42;
    for (const beat of beats) {
      const span = beat.end - beat.start;
      const local = (progress - beat.start) / span;
      const fadeIn = beat.start === 0 ? 1 : smooth(0, BEAT_FADE, local);
      const fadeOut = 1 - smooth(1 - BEAT_FADE, 1, local);
      const opacity = motionPreference.matches ? 1 : fadeIn * fadeOut;
      // The qualities settle while all three are being read, then move on;
      // every other passage keeps travelling upward with the scroll.
      const drift = beat.reading
        ? 0.35 * travel * (1 - fadeIn) - 0.35 * travel * (1 - fadeOut)
        : (0.5 - clamp(local)) * travel;
      const shift = motionPreference.matches ? 0 : drift;
      beat.element.style.opacity = opacity.toFixed(3);
      beat.element.style.setProperty("--beat-progress", clamp(local).toFixed(4));
      beat.element.style.setProperty("--beat-shift", `${shift.toFixed(1)}px`);
      // Every beat stays readable to screen readers; only links that can't be
      // seen leave the tab order.
      const shown = opacity > 0.05;
      beat.element.classList.toggle("is-shown", shown);
      for (const link of beat.links) {
        if (shown) link.removeAttribute("tabindex");
        else link.setAttribute("tabindex", "-1");
      }
    }
  }

  // Phones get the portrait render, which widens its view as the live scene did.
  function pickSource() {
    if (!video) return;
    const wanted = stage.clientHeight > stage.clientWidth * 1.05 ? "portrait" : "landscape";
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
    placeBeats();
    journey.dataset.progress = progress.toFixed(3);
    const camera = cameraAt(progress);

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

  window.addEventListener("scroll", schedule, { passive: true });
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
