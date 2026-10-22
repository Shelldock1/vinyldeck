import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// ── Global styles (order matters) ────────────────────────────
import "./styles/global.css";
import "./styles/themes.css";
import "./styles/animations.css";
import "./styles/soft-render.css";

// ── Apply default theme before first paint ───────────────────
document.documentElement.setAttribute("data-theme", "noir");

// ── Paint profile before first paint ─────────────────────────
// Linux WebViews (WebKitGTK) may composite on the CPU with no GPU
// process, where the full optical stack costs 110-190 ms per frame.
// Mark the document so styles/soft-render.css can switch the app to
// a cheaper paint path. Windows keeps the full stack.
const isLinuxWebView =
  /Linux/.test(navigator.userAgent) && !/Android/.test(navigator.userAgent);
if (isLinuxWebView) {
  document.documentElement.setAttribute("data-soft-render", "1");
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
