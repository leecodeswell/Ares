import { STATUE_COUNT, scrollPoint } from "./statues.js";

// The story's passages are no longer laid over the flight. Statues along the
// colonnade hold out scrolls instead (baked into the video), and a button over
// each scroll opens its passage in a reader, so all of the text is optional.
// A list of every scroll stays in the corner, so each passage is always
// reachable whether or not its statue is on screen.

const VIDEO = { landscape: [1920, 1080], portrait: [864, 1536] };
const NUMERALS = ["I", "II", "III", "IV", "V"];
const EDGE = 30; // markers that leave the screen while their statue is near stay pinned this far in
const NEAR = 18; // metres: closer than this, a statue's marker is offered

const sub = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => {
  const length = Math.hypot(...a);
  return a.map((v) => v / length);
};

export function setUpScrolls(journey, stage, beats) {
  const passages = beats.slice(0, STATUE_COUNT);
  const read = passages.map(() => false);
  journey.classList.add("has-scrolls");

  // the reader: one dialog, filled with a copy of the chosen passage
  const reader = document.createElement("dialog");
  reader.className = "scroll-reader";
  reader.setAttribute("aria-labelledby", "scroll-reader-title");
  reader.innerHTML = `
    <div class="scroll-reader-roller" aria-hidden="true"></div>
    <div class="scroll-reader-sheet">
      <button class="scroll-reader-close" type="button" aria-label="Close scroll">×</button>
      <p class="scroll-reader-label" id="scroll-reader-title"></p>
      <div class="scroll-reader-body"></div>
      <div class="scroll-reader-nav">
        <button type="button" data-step="-1">← Previous scroll</button>
        <button type="button" data-step="1">Next scroll →</button>
      </div>
    </div>
    <div class="scroll-reader-roller" aria-hidden="true"></div>`;
  document.body.append(reader);
  const body = reader.querySelector(".scroll-reader-body");
  const title = reader.querySelector(".scroll-reader-label");
  let current = 0;

  function open(index) {
    current = index;
    read[index] = true;
    const copy = passages[index].element.cloneNode(true);
    // the copy must not repeat the ids the page already uses
    for (const element of [copy, ...copy.querySelectorAll("[id]")]) element.removeAttribute("id");
    for (const name of ["aria-labelledby", "data-beat", "data-reading-beat", "data-label"]) copy.removeAttribute(name);
    copy.className = "scroll-reader-passage";
    copy.style.cssText = "";
    body.replaceChildren(copy);
    title.textContent = `Scroll ${NUMERALS[index]} · ${passages[index].label}`;
    reader.querySelector('[data-step="-1"]').hidden = index === 0;
    reader.querySelector('[data-step="1"]').hidden = index === passages.length - 1;
    // following a link in the passage closes the reader first
    for (const link of copy.querySelectorAll("a")) link.addEventListener("click", () => reader.close());
    if (!reader.open) reader.showModal();
    refresh();
  }
  reader.querySelector(".scroll-reader-close").addEventListener("click", () => reader.close());
  reader.addEventListener("click", (event) => {
    if (event.target === reader) reader.close();
  });
  for (const button of reader.querySelectorAll("[data-step]")) {
    button.addEventListener("click", () => open(current + Number(button.dataset.step)));
  }

  // a marker button over each statue's scroll
  const layer = document.createElement("div");
  layer.className = "scroll-markers";
  stage.append(layer);
  const markers = passages.map((passage, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "scroll-marker";
    button.textContent = NUMERALS[index];
    button.dataset.label = passage.label;
    button.setAttribute("aria-label", `Read scroll ${NUMERALS[index]}: ${passage.label}`);
    button.addEventListener("click", () => open(index));
    layer.append(button);
    return button;
  });

  // and a list of every scroll
  const index = document.createElement("nav");
  index.className = "scroll-index";
  index.setAttribute("aria-label", "Scrolls along the colonnade");
  index.innerHTML = `<ol id="scroll-index-list" hidden></ol><button class="scroll-index-toggle" type="button" aria-expanded="false" aria-controls="scroll-index-list">Scrolls · <span></span>/${passages.length} read</button>`;
  stage.append(index);
  const list = index.querySelector("ol");
  const toggle = index.querySelector(".scroll-index-toggle");
  toggle.addEventListener("click", () => {
    list.hidden = !list.hidden;
    toggle.setAttribute("aria-expanded", String(!list.hidden));
  });
  passages.forEach((passage, i) => {
    const item = document.createElement("li");
    item.innerHTML = `<button type="button"><span class="scroll-index-number">${NUMERALS[i]}</span><span>${passage.label}</span><span class="scroll-index-read">read</span></button>`;
    item.querySelector("button").addEventListener("click", () => open(i));
    list.append(item);
  });

  function refresh() {
    toggle.querySelector("span").textContent = read.filter(Boolean).length;
    markers.forEach((marker, i) => marker.classList.toggle("is-read", read[i]));
    [...list.children].forEach((item, i) => item.classList.toggle("is-read", read[i]));
  }
  refresh();

  // Place each marker where its scroll is in the current frame: the same
  // camera and field of view the frame was rendered with
  // (tools/render-journey/harness.js), mirrored, and cropped like the
  // video's object-fit: cover.
  function place(camera, shape) {
    const [vw, vh] = VIDEO[shape] || VIDEO.landscape;
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    const degrees = Math.PI / 180;
    const fov = Math.min(75 * degrees, Math.max(camera.fov * degrees, 2 * Math.atan(Math.tan(25 * degrees) / (vw / vh))));
    const focal = 0.5 / Math.tan(fov / 2);
    const forward = norm(sub(camera.target, camera.position));
    const right = norm(cross([0, 1, 0], forward));
    const up = cross(forward, right);
    const scale = Math.max(width / vw, height / vh);
    const offsetX = (width - vw * scale) / 2;
    const offsetY = (height - vh * scale) / 2;
    markers.forEach((marker, i) => {
      const d = sub(scrollPoint(i), camera.position);
      const depth = dot(d, forward);
      const near = depth > 0.8 && depth < NEAR && camera.flight < 0.97;
      let x = offsetX + (vw - (vw / 2 + (dot(d, right) / depth) * focal * vh)) * scale;
      let y = offsetY + (vh / 2 - (dot(d, up) / depth) * focal * vh) * scale;
      const pinned = x < EDGE || x > width - EDGE || y < EDGE || y > height - EDGE;
      x = Math.min(width - EDGE, Math.max(EDGE, x));
      y = Math.min(height - EDGE, Math.max(EDGE + 40, y));
      marker.hidden = !near;
      marker.classList.toggle("is-pinned", pinned);
      marker.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
    });
  }

  return { place };
}
