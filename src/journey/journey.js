import "./journey.css";
import skyUrl from "./sky.webp";
import marbleUrl from "./marble.webp";
import { VERTEX, FRAGMENT } from "./scene.js";

// The journey: a camera flies up the steps and down a static marble
// colonnade, through the arch in its far wall and out into open sky, while
// the story's words arrive in step. The building is real 3D (scene.js); only
// the camera moves.

const FLIGHT_END = 0.84; // share of the journey before the camera clears the arch
const PAPER = [232 / 255, 231 / 255, 221 / 255]; // the showcase background that follows

// Camera keyframes through the building: [flight share, position, look-at].
const PATH = [
  [0.0, [-0.7, 0.3, -7.5], [-10.45, 2.1, 20.8]], // on the terrace, framed like the sanctuary photograph
  [0.14, [-0.4, 0.9, -4.4], [-4.5, 2.5, 24]], // turning toward the steps
  [0.28, [0, 1.6, 1.5], [0.2, 2.8, 34]], // up the steps, between the first columns
  [0.52, [0, 1.75, 16], [0, 2.7, 52]], // halfway down the corridor
  [0.78, [0, 1.95, 33], [0, 2.5, 70]], // the arch ahead
  [0.92, [0, 2.1, 40.4], [0, 2.6, 75]], // at the threshold
  [1.0, [0, 2.3, 44.5], [0, 3.2, 80]], // through, above the clouds
];

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const smooth = (edge0, edge1, value) => {
  const x = clamp((value - edge0) / (edge1 - edge0));
  return x * x * (3 - 2 * x);
};

const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
const root = document.querySelector("[data-journey]");
if (root) setUpJourney(root);

// Catmull-Rom through the keyframes, so the camera glides without corners.
function along(index, local, pick) {
  const at = (i) => PATH[Math.min(PATH.length - 1, Math.max(0, i))][pick];
  const p0 = at(index - 1), p1 = at(index), p2 = at(index + 1), p3 = at(index + 2);
  const t = local, t2 = t * t, t3 = t2 * t;
  return p1.map((_, k) =>
    0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3),
  );
}

/** Where the camera is, and what the frame looks like, for a share of the journey (0-1). */
export function cameraAt(progress) {
  const flight = clamp(progress / FLIGHT_END);
  const sky = clamp((progress - FLIGHT_END) / (1 - FLIGHT_END));
  let index = 0;
  while (index < PATH.length - 2 && flight > PATH[index + 1][0]) index++;
  const local = clamp((flight - PATH[index][0]) / (PATH[index + 1][0] - PATH[index][0]));
  const eased = local * local * (3 - 2 * local) * 0.35 + local * 0.65;
  let position = along(index, eased, 1);
  let target = along(index, eased, 2);
  if (sky > 0) {
    // Out over the clouds the camera keeps drifting forward and lifts its gaze.
    const lift = smooth(0, 1, sky);
    position = [position[0], position[1] + 3.5 * lift, position[2] + 14 * lift];
    target = [target[0], target[1] + 22 * lift, target[2]];
  }
  return {
    flight,
    position,
    target,
    // a slightly long lens at the start, like the photograph; wider inside
    fov: 46 + 9 * smooth(0.05, 0.3, flight),
    glow: 0.35 * smooth(0.86, 0.99, flight) * (1 - smooth(0, 0.45, sky)),
    paper: smooth(0.55, 1, sky),
  };
}

function setUpJourney(journey) {
  const stage = journey.querySelector("[data-journey-stage]");
  const canvas = journey.querySelector("[data-journey-canvas]");
  const still = journey.querySelector("[data-journey-still]");
  const scrim = journey.querySelector(".journey-scrim");
  const beats = [...journey.querySelectorAll("[data-beat]")].map((element) => {
    const [start, end] = element.dataset.beat.split(" ").map(Number);
    return { element, start, end, links: [...element.querySelectorAll("a")] };
  });

  let gl = null;
  let uniforms = {};
  let ready = false;
  let progress = 0;
  let framePending = false;
  let restTimer = 0;
  // Resolution while moving adapts to the device; at rest one crisp frame is drawn.
  let movingScale = 0.6;
  let lastFrameAt = 0;
  let slowFrames = 0;
  let fastFrames = 0;

  function measure() {
    const rect = journey.getBoundingClientRect();
    const distance = Math.max(1, rect.height - window.innerHeight);
    return clamp(-rect.top / distance);
  }

  // Each beat fades and drifts in, holds, and leaves before the next arrives.
  function placeBeats() {
    for (const beat of beats) {
      const span = beat.end - beat.start;
      const local = (progress - beat.start) / span;
      const fadeIn = beat.start === 0 ? 1 : smooth(0, 0.18, local);
      const fadeOut = 1 - smooth(0.82, 1, local);
      const opacity = motionPreference.matches ? 1 : fadeIn * fadeOut;
      const shift = motionPreference.matches ? 0 : (0.5 - clamp(local)) * 60;
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

  function sizeCanvas(scale) {
    const width = Math.max(1, Math.round(stage.clientWidth * scale));
    const height = Math.max(1, Math.round(stage.clientHeight * scale));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  function restingScale() {
    // Crisp, but capped near 1.7 million pixels.
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    const pixels = stage.clientWidth * stage.clientHeight * ratio * ratio;
    return ratio * Math.min(1, Math.sqrt(1.7e6 / Math.max(1, pixels)));
  }

  function render(camera, scale) {
    sizeCanvas(scale);
    gl.viewport(0, 0, canvas.width, canvas.height);
    const aspect = canvas.width / canvas.height;
    // Keep at least ~50° across on tall phone screens.
    const fov = Math.min((75 * Math.PI) / 180, Math.max((camera.fov * Math.PI) / 180, 2 * Math.atan(Math.tan((25 * Math.PI) / 180) / aspect)));
    gl.uniform2f(uniforms.uResolution, canvas.width, canvas.height);
    gl.uniform3f(uniforms.uCamera, ...camera.position);
    gl.uniform3f(uniforms.uTarget, ...camera.target);
    gl.uniform1f(uniforms.uFov, fov);
    // reflections, sun shafts and bounced light switch off only while moving on slow devices
    gl.uniform1f(uniforms.uQuality, scale >= 0.45 ? 1 : 0);
    gl.uniform1f(uniforms.uGlow, camera.glow);
    gl.uniform1f(uniforms.uPaperAmount, camera.paper);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  function draw(now = performance.now()) {
    framePending = false;
    progress = motionPreference.matches ? 0 : measure();
    placeBeats();
    const camera = cameraAt(progress);
    journey.dataset.progress = progress.toFixed(3);
    // The text backdrop lifts with the final fade so the page meets the next
    // section on exactly its colour.
    if (scrim) scrim.style.opacity = (1 - camera.paper).toFixed(3);

    if (!ready) {
      if (still) {
        // Without WebGL the photograph itself pushes gently toward its arch.
        still.style.transform = `scale(${(1 + 1.4 * smooth(0, 1, camera.flight)).toFixed(4)})`;
        still.style.opacity = String(1 - camera.paper);
      }
      return;
    }
    const visible = journey.getBoundingClientRect();
    if (visible.bottom < 0 || visible.top > window.innerHeight) return;

    // Adapt the moving resolution to how quickly frames come back.
    if (lastFrameAt && now - lastFrameAt < 200) {
      const interval = now - lastFrameAt;
      if (interval > 34) slowFrames++;
      else if (interval < 20) fastFrames++;
      if (slowFrames > 4) { movingScale = Math.max(0.32, movingScale * 0.85); slowFrames = 0; fastFrames = 0; }
      if (fastFrames > 20) { movingScale = Math.min(0.85, movingScale * 1.08); slowFrames = 0; fastFrames = 0; }
    }
    lastFrameAt = now;

    render(camera, Math.min(movingScale, restingScale()));
    window.clearTimeout(restTimer);
    restTimer = window.setTimeout(() => {
      if (!ready || motionPreference.matches) return;
      render(cameraAt(measure()), restingScale());
      lastFrameAt = 0;
    }, 180);
  }

  function schedule() {
    if (!framePending) {
      framePending = true;
      window.requestAnimationFrame(draw);
    }
  }

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) || "Shader failed to compile");
    }
    return shader;
  }

  function startWebGL() {
    gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false, powerPreference: "high-performance" });
    if (!gl) return;
    let program;
    try {
      program = gl.createProgram();
      gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error("Program failed to link");
      gl.useProgram(program);
    } catch {
      gl = null;
      return;
    }
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    for (const name of ["uResolution", "uCamera", "uTarget", "uFov", "uSky", "uMarble", "uQuality", "uGlow", "uPaper", "uPaperAmount"]) {
      uniforms[name] = gl.getUniformLocation(program, name);
    }
    gl.uniform1i(uniforms.uSky, 0);
    gl.uniform1i(uniforms.uMarble, 1);
    gl.uniform3f(uniforms.uPaper, ...PAPER);

    const loadTexture = (unit, url, repeat) =>
      new Promise((resolve, reject) => {
        const image = new Image();
        image.decoding = "async";
        image.addEventListener("load", () => {
          gl.activeTexture(gl.TEXTURE0 + unit);
          gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
          const wrap = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
          if (repeat) gl.generateMipmap(gl.TEXTURE_2D); // the marble tile is 1024 px, so it can repeat and mipmap
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, repeat ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
          resolve();
        });
        image.addEventListener("error", reject);
        image.src = url;
      });
    Promise.all([loadTexture(0, skyUrl, false), loadTexture(1, marbleUrl, true)])
      .then(() => {
        ready = true;
        journey.classList.add("is-flying");
        if (still) still.style.transform = "";
        schedule();
      })
      .catch(() => {});
  }

  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    ready = false;
    journey.classList.remove("is-flying");
  });

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule, { passive: true });
  motionPreference.addEventListener("change", () => {
    if (!motionPreference.matches && !gl) startWebGL();
    schedule();
  });

  // Prepare the scene shortly before the journey comes into view.
  if (motionPreference.matches) {
    placeBeats();
  } else if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          startWebGL();
        }
      },
      { rootMargin: "100% 0px" },
    );
    observer.observe(journey);
    schedule();
  } else {
    startWebGL();
  }
}
