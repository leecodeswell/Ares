import "./style.css";
import { introEnd } from "./intro/intro.js";
import "@fontsource/cormorant-garamond/latin-400.css";
import "@fontsource/cormorant-garamond/latin-500.css";
import "@fontsource/cormorant-garamond/latin-400-italic.css";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-600.css";

const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
const smallScreen = window.matchMedia("(max-width: 700px)");
const header = document.querySelector(".site-header");
const progress = document.querySelector("#scroll-progress");
const scenes = [...document.querySelectorAll("[data-scene]")];
const parallaxElements = [...document.querySelectorAll("[data-parallax]")];
const filmScenes = [...document.querySelectorAll("[data-film-scene]")].map(
  (element) => ({
    element,
    images: [...element.querySelectorAll("[data-film-image]")],
  }),
);
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

// Native scrolling remains in control. Each visible scene receives one progress
// value per frame; reduced motion leaves the story and all content intact.
let framePending = false;
function paintScroll() {
  framePending = false;
  // The opening sequence sits above the site, so reading starts at the hero.
  const start = introEnd();
  const available =
    document.documentElement.scrollHeight - window.innerHeight - start;
  const position =
    available > 0 ? clamp((window.scrollY - start) / available) : 0;
  progress?.style.setProperty("transform", `scaleX(${position})`);
  header?.classList.toggle("is-scrolled", window.scrollY > start + 32);
  for (const scene of scenes) {
    const rect = scene.getBoundingClientRect();
    if (rect.bottom < -100 || rect.top > window.innerHeight + 100) continue;
    const distance = Math.max(1, rect.height - window.innerHeight);
    const value = motionPreference.matches ? 0 : clamp(-rect.top / distance);
    scene.style.setProperty("--scene-progress", value.toFixed(4));
  }
  for (const element of parallaxElements) {
    if (motionPreference.matches || smallScreen.matches) {
      element.style.setProperty("--parallax-y", "0px");
      continue;
    }
    const rect = element.parentElement.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) continue;
    const speed =
      Number(element.dataset.speed || element.dataset.parallax) || 0.08;
    const offset = clamp(-rect.top * speed, -45, 85);
    element.style.setProperty("--parallax-y", `${offset.toFixed(2)}px`);
  }
  for (const { element, images } of filmScenes) {
    const rect = element.getBoundingClientRect();
    const visible = rect.bottom > 0 && rect.top < window.innerHeight;
    element.classList.toggle(
      "is-film-active",
      visible && !motionPreference.matches,
    );
    if (!visible && !motionPreference.matches) continue;

    const sticky = element.matches("#vision");
    const opening = element.matches("#home");
    const distance = sticky
      ? Math.max(1, rect.height - window.innerHeight)
      : opening
        ? Math.max(1, rect.height)
        : rect.height + window.innerHeight;
    const travel = sticky || opening
      ? -rect.top
      : window.innerHeight - rect.top;
    const phase = motionPreference.matches ? 0 : clamp(travel / distance);
    element.style.setProperty("--film-progress", phase.toFixed(4));

    // A slow push and small vertical drift give stills depth without hijacking
    // the scroll. The portrait layout uses a smaller move to keep the face framed.
    const zoom = smallScreen.matches ? 0.025 : 0.065;
    const drift = smallScreen.matches ? 10 : 28;
    const scale = motionPreference.matches ? 1 : 1.04 + phase * zoom;
    const offset = motionPreference.matches ? 0 : -phase * drift;
    for (const image of images) {
      image.style.setProperty("--film-scale", scale.toFixed(4));
      image.style.setProperty("--film-y", `${offset.toFixed(2)}px`);
    }
  }
}
function scheduleScroll() {
  if (!framePending) {
    framePending = true;
    window.requestAnimationFrame(paintScroll);
  }
}
window.addEventListener("scroll", scheduleScroll, { passive: true });
window.addEventListener("resize", scheduleScroll, { passive: true });
motionPreference.addEventListener("change", scheduleScroll);
smallScreen.addEventListener("change", scheduleScroll);
paintScroll();

const revealElements = [...document.querySelectorAll("[data-reveal]")];
if ("IntersectionObserver" in window && !motionPreference.matches) {
  document.documentElement.classList.add("motion-ready");
  const revealObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.08 },
  );
  revealElements.forEach((element) => revealObserver.observe(element));
  motionPreference.addEventListener("change", (event) => {
    if (event.matches) {
      revealObserver.disconnect();
      revealElements.forEach((element) => element.classList.add("is-visible"));
    }
  });
} else {
  revealElements.forEach((element) => element.classList.add("is-visible"));
}

const menuToggle = document.querySelector("[data-menu-toggle]");
const menu = document.querySelector("#mobile-menu");
function setMenu(open, returnFocus = false) {
  if (!menuToggle || !menu) return;
  menuToggle.setAttribute("aria-expanded", String(open));
  menuToggle.setAttribute(
    "aria-label",
    open ? "Close navigation" : "Open navigation",
  );
  menu.hidden = !open;
  menu.classList.toggle("is-open", open);
  document.body.classList.toggle("menu-open", open);
  if (open) menu.querySelector("a")?.focus();
  if (returnFocus) menuToggle.focus();
}
menuToggle?.addEventListener("click", () =>
  setMenu(menuToggle.getAttribute("aria-expanded") !== "true"),
);
menu?.querySelectorAll("a").forEach((link) =>
  link.addEventListener("click", () => {
    setMenu(false);
    const destination = document.querySelector(link.hash);
    if (destination) {
      destination.setAttribute("tabindex", "-1");
      destination.focus({ preventScroll: true });
      destination.addEventListener(
        "blur",
        () => destination.removeAttribute("tabindex"),
        { once: true },
      );
    }
  }),
);
document.addEventListener("keydown", (event) => {
  if (menuToggle?.getAttribute("aria-expanded") !== "true") return;
  if (event.key === "Escape") {
    event.preventDefault();
    setMenu(false, true);
  }
  if (event.key === "Tab") {
    const focusable = [menuToggle, ...menu.querySelectorAll("a, button")];
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
});
window.matchMedia("(min-width: 761px)").addEventListener("change", (event) => {
  if (event.matches) setMenu(false);
});

const concepts = {
  ivory: {
    name: "Your business",
    type: "THE CLASSICAL DIRECTION",
    tagline: "Make a lasting impression.",
    description: "Quiet confidence. Warm light. Space for your story.",
    hours: "Considered. Timeless. Yours.",
    note: "Ivory / soft gold / sculptural serif",
  },
  botanical: {
    name: "Your business",
    type: "THE ORGANIC DIRECTION",
    tagline: "A little more naturally you.",
    description: "Fresh color. Soft shapes. A welcoming place to begin.",
    hours: "Grounded. Open. Yours.",
    note: "Sage / warm cream / organic forms",
  },
  obsidian: {
    name: "Your business",
    type: "THE CONTEMPORARY DIRECTION",
    tagline: "Made for what comes next.",
    description: "Bold contrast. Clear ideas. A presence with purpose.",
    hours: "Distinct. Direct. Yours.",
    note: "Charcoal / champagne / precise typography",
  },
};
const tabs = [...document.querySelectorAll("[data-concept]")];
const panel = document.querySelector("#concept-panel");
const demoStatus = document.querySelector("#demo-status");
let currentConcept = "ivory";
function selectConcept(key, focus = false) {
  const concept = concepts[key];
  if (!concept || !panel) return;
  currentConcept = key;
  panel.dataset.theme = key;
  for (const tab of tabs) {
    const selected = tab.dataset.concept === key;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
    if (selected) {
      panel.setAttribute("aria-labelledby", tab.id);
      if (focus) tab.focus();
    }
  }
  for (const [field, value] of Object.entries(concept)) {
    const element = document.querySelector(`#concept-${field}`);
    if (element) element.textContent = value;
  }
  if (demoStatus) demoStatus.textContent = "";
}
tabs.forEach((tab, index) => {
  tab.addEventListener("click", () => selectConcept(tab.dataset.concept));
  tab.addEventListener("keydown", (event) => {
    let next;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    if (event.key === "ArrowLeft")
      next = (index - 1 + tabs.length) % tabs.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = tabs.length - 1;
    if (next !== undefined) {
      event.preventDefault();
      selectConcept(tabs[next].dataset.concept, true);
    }
  });
});
selectConcept("ivory");
document.querySelectorAll("[data-demo-action]").forEach((button) => {
  button.addEventListener("click", () => {
    if (demoStatus) {
      demoStatus.textContent = `${currentConcept[0].toUpperCase() + currentConcept.slice(1)} is one starting point. Your website would be designed around your own business.`;
    }
    const themeField = document.querySelector(
      '#inquiry-form [name="direction"]',
    );
    if (themeField) themeField.value = currentConcept;
  });
});

const inquiry = document.querySelector("#inquiry-form");
const inquiryStatus = document.querySelector("#inquiry-status");
const draftLink = document.querySelector("#email-draft-link");
inquiry?.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!inquiry.reportValidity()) return;
  const data = new FormData(inquiry);
  const read = (name) => String(data.get(name) || "").trim();
  const name = read("name").replace(/[\r\n]/g, " ");
  const body = [
    `Hi Lee,`,
    "",
    `I'd like to talk about a website for ${read("business") || "my business"}.`,
    "",
    read("message"),
    "",
    `Name: ${name}`,
    `Email: ${read("email")}`,
    `Business: ${read("business") || "Not provided"}`,
    ...(read("direction")
      ? [`Design direction I explored: ${read("direction")}`]
      : []),
  ].join("\n");
  const href = `mailto:thompsontechnologiesleet@gmail.com?subject=${encodeURIComponent(`Ares website inquiry — ${name}`)}&body=${encodeURIComponent(body)}`;
  const link = draftLink || document.createElement("a");
  link.href = href;
  if (draftLink) draftLink.hidden = false;
  link.click();
  if (inquiryStatus) {
    inquiryStatus.textContent =
      "Your email draft is prepared. Review and send it in your email app. If it did not open, use the draft link below or email Lee directly.";
  }
});

document.querySelectorAll("[data-year]").forEach((element) => {
  element.textContent = new Date().getFullYear();
});
