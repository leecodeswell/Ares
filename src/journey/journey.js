import "./journey.css";
import corridorUrl from "./corridor.webp";
import skyUrl from "./sky.webp";

// The journey: a camera flies down the sanctuary colonnade, through the far
// arch and out into open sky while the story's words arrive in step. The
// photograph is split into a stone layer and a sky layer
// (tools/build-journey-layers.py). The stone is treated as a corridor whose
// depth grows toward the arch, so near columns sweep past faster than far
// ones; the sky sits at infinity and only turns with the camera.

const IMAGE = { width: 1672, height: 941 };
const VANISHING = { x: 1253, y: 480 }; // where the corridor's lines meet
const ARCH = { x: 1253, y: 462 }; // centre of the far arch opening
const CORRIDOR = { side: 75, up: 205, down: 135 }; // far end, in pixels from the vanishing point
const FLIGHT_END = 0.84; // share of the journey spent inside the colonnade
const MAX_ZOOM = 17; // how large the far arch grows before we pass through it
const PAPER = [232 / 255, 231 / 255, 221 / 255]; // the showcase background that follows

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const smooth = (edge0, edge1, value) => {
  const x = clamp((value - edge0) / (edge1 - edge0));
  return x * x * (3 - 2 * x);
};
const mix = (a, b, amount) => a + (b - a) * amount;

const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
const root = document.querySelector("[data-journey]");
if (root) setUpJourney(root);

/** Where the camera is for a given share of the journey (0-1). */
export function cameraAt(progress) {
  const flight = clamp(progress / FLIGHT_END);
  const skyPhase = clamp((progress - FLIGHT_END) / (1 - FLIGHT_END));
  return {
    flight,
    // Forward travel, eased so the arch grows at a steady rate on screen.
    travel: 1 - Math.pow(MAX_ZOOM, -Math.pow(flight, 1.9)),
    turn: smooth(0, 0.85, flight),
    stone: 1 - smooth(0.965, 1, flight),
    glow: 0.4 * smooth(0.8, 0.985, flight) * (1 - smooth(0, 0.4, skyPhase)),
    skyZoom: 1 + 0.24 * smooth(0, 1, skyPhase),
    paper: smooth(0.55, 1, skyPhase),
  };
}

const VERTEX = `
attribute vec2 aPosition;
void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }
`;

const FRAGMENT = `
precision highp float;
uniform sampler2D uStone;
uniform sampler2D uSky;
uniform vec2 uImage;
uniform vec2 uVanishing;
uniform vec3 uCorridor;     // side, up, down
uniform vec2 uCenter;       // image point at the middle of the screen
uniform float uScale;       // image pixels per canvas pixel
uniform vec2 uResolution;
uniform float uTravel;
uniform float uBlur;
uniform float uStoneOpacity;
uniform float uGlow;
uniform float uSkyZoom;
uniform vec3 uPaper;
uniform float uPaperAmount;

vec2 mirrored(vec2 uv) { return 1.0 - abs(1.0 - mod(uv, 2.0)); }

void main() {
  vec2 frag = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y);
  vec2 p = uCenter + (frag - 0.5 * uResolution) * uScale;

  // Sky: infinitely far, so travel never moves it; it eases in once we're out.
  vec2 skyFocus = vec2(uCenter.x, 0.24 * uImage.y);
  vec3 sky = texture2D(uSky, mirrored((skyFocus + (p - skyFocus) / uSkyZoom) / uImage)).rgb;

  // Stone: a corridor whose depth is set by the nearest of its walls, floor and
  // ceiling; the far wall with the arch sits at depth 1. Moving forward by
  // uTravel, find where each screen point came from in the photograph.
  vec2 d = p - uVanishing;
  float reach = max(abs(d.x) / uCorridor.x, d.y > 0.0 ? d.y / uCorridor.z : -d.y / uCorridor.y) + 1e-4;
  float farWall = 1.0 / (1.0 - uTravel);
  float source = reach <= farWall ? reach * (1.0 - uTravel) : reach / (1.0 + uTravel * reach);
  float k = source / reach;

  // Motion blur along the direction of travel while the visitor scrolls.
  vec4 stone = vec4(0.0);
  for (int i = 0; i < 8; i++) {
    float f = k * (1.0 - uBlur * float(i) / 8.0);
    vec4 c = texture2D(uStone, clamp((uVanishing + d * f) / uImage, 0.0, 1.0));
    stone += vec4(c.rgb * c.a, c.a);
  }
  stone *= uStoneOpacity / 8.0;

  vec3 color = sky * (1.0 - stone.a) + stone.rgb;
  float r = length((frag - 0.5 * uResolution) / uResolution.y);
  color = mix(color, vec3(1.0, 0.985, 0.955), uGlow * (1.0 - smoothstep(0.0, 0.95, r)));
  color = mix(color, uPaper, uPaperAmount);
  gl_FragColor = vec4(color, 1.0);
}
`;

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
  let program = null;
  let uniforms = {};
  let ready = false;
  let progress = 0;
  let lastTravel = 0;
  let blur = 0;
  let framePending = false;

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

  function viewCenter(camera, scale) {
    // Start on the photograph as the site showed it, then turn toward the arch.
    const halfWidth = (canvas.width * scale) / 2;
    const halfHeight = (canvas.height * scale) / 2;
    const startX = clamp(1130, halfWidth, IMAGE.width - halfWidth);
    const startY = clamp(IMAGE.height / 2, halfHeight, IMAGE.height - halfHeight);
    return [mix(startX, ARCH.x, camera.turn), mix(startY, ARCH.y, camera.turn)];
  }

  function draw() {
    framePending = false;
    progress = motionPreference.matches ? 0 : measure();
    placeBeats();
    const camera = cameraAt(progress);
    journey.dataset.progress = progress.toFixed(3);
    // The text backdrop lifts with the final fade so the page meets the next
    // section on exactly its colour.
    if (scrim) scrim.style.opacity = (1 - camera.paper).toFixed(3);
    journey.classList.toggle("is-sky", camera.flight >= 1);

    // Blur follows scroll speed and settles when the visitor stops.
    const speed = Math.abs(camera.travel - lastTravel);
    lastTravel = camera.travel;
    blur += (clamp(speed * 5, 0, 0.07) - blur) * 0.35;
    if (blur < 0.0015) blur = 0;

    if (!ready) {
      if (still) {
        // Without WebGL the photograph itself pushes toward the arch.
        const zoom = mix(1, 3.2, camera.travel / 0.941);
        still.style.transform = `scale(${zoom.toFixed(4)})`;
        still.style.opacity = String(1 - camera.paper);
      }
      return;
    }

    const scale = Math.min(IMAGE.width / canvas.width, IMAGE.height / canvas.height);
    const [cx, cy] = viewCenter(camera, scale);
    gl.uniform2f(uniforms.uCenter, cx, cy);
    gl.uniform1f(uniforms.uScale, scale);
    gl.uniform2f(uniforms.uResolution, canvas.width, canvas.height);
    gl.uniform1f(uniforms.uTravel, camera.travel);
    gl.uniform1f(uniforms.uBlur, blur);
    gl.uniform1f(uniforms.uStoneOpacity, camera.stone);
    gl.uniform1f(uniforms.uGlow, camera.glow);
    gl.uniform1f(uniforms.uSkyZoom, camera.skyZoom);
    gl.uniform1f(uniforms.uPaperAmount, camera.paper);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    if (blur > 0) schedule();
  }

  function schedule() {
    if (!framePending) {
      framePending = true;
      window.requestAnimationFrame(draw);
    }
  }

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    // The photograph is 1672 px wide; rendering much beyond that adds nothing.
    const scaleDown = Math.min(1, 1920 / (stage.clientWidth * ratio));
    canvas.width = Math.max(1, Math.round(stage.clientWidth * ratio * scaleDown));
    canvas.height = Math.max(1, Math.round(stage.clientHeight * ratio * scaleDown));
    if (gl) gl.viewport(0, 0, canvas.width, canvas.height);
    schedule();
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

  function loadTexture(unit, url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.addEventListener("load", () => {
        const texture = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        resolve();
      });
      image.addEventListener("error", reject);
      image.src = url;
    });
  }

  function startWebGL() {
    gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false, powerPreference: "high-performance" });
    if (!gl) return;
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
    for (const name of ["uStone", "uSky", "uImage", "uVanishing", "uCorridor", "uCenter", "uScale", "uResolution", "uTravel", "uBlur", "uStoneOpacity", "uGlow", "uSkyZoom", "uPaper", "uPaperAmount"]) {
      uniforms[name] = gl.getUniformLocation(program, name);
    }
    gl.uniform1i(uniforms.uStone, 0);
    gl.uniform1i(uniforms.uSky, 1);
    gl.uniform2f(uniforms.uImage, IMAGE.width, IMAGE.height);
    gl.uniform2f(uniforms.uVanishing, VANISHING.x, VANISHING.y);
    gl.uniform3f(uniforms.uCorridor, CORRIDOR.side, CORRIDOR.up, CORRIDOR.down);
    gl.uniform3f(uniforms.uPaper, ...PAPER);
    resize();
    Promise.all([loadTexture(0, corridorUrl), loadTexture(1, skyUrl)])
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
  window.addEventListener("resize", resize, { passive: true });
  motionPreference.addEventListener("change", () => {
    if (!motionPreference.matches && !gl) startWebGL();
    schedule();
  });

  // Prepare the flight shortly before the journey comes into view.
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
