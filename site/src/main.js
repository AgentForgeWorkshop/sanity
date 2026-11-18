import "@fontsource/schibsted-grotesk/400.css";
import "@fontsource/schibsted-grotesk/500.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "katex/dist/katex.min.css";
import katex from "katex";
import "./style.css";
import { mount } from "./demo.js";
import { mountStage } from "./agents.js";

mount(katex);
mountStage();

document.querySelectorAll(".icon[data-logo]").forEach((el) => {
  const url = new URL(el.dataset.logo, document.baseURI).href;
  const mask = `url("${url}") center / contain no-repeat`;
  el.style.mask = mask;
  el.style.webkitMask = mask;
  el.style.visibility = "visible";
});
