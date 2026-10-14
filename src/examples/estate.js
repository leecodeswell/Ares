import "@fontsource/fraunces/latin-300.css";
import "@fontsource/fraunces/latin-400.css";
import "@fontsource/fraunces/latin-400-italic.css";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "./ribbon.css";
import "./estate.css";

// A design example: the search shows the homes below instead of leaving the page.
document.querySelector(".es-search")?.addEventListener("submit", (event) => {
  event.preventDefault();
  document.querySelector("#homes")?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
});
