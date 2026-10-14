import "@fontsource/bodoni-moda/latin-400.css";
import "@fontsource/bodoni-moda/latin-500.css";
import "@fontsource/bodoni-moda/latin-400-italic.css";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "./ribbon.css";
import "./counsel.css";

// A design example: the form confirms on the page and sends nothing.
const form = document.querySelector(".cv-form");
form?.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  form.querySelector(".cv-form-status").textContent =
    "Thank you. In a real site, a partner would reply within one business day. (This example sends nothing.)";
});
