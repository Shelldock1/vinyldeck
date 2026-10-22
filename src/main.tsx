import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// ── Global styles (order matters) ────────────────────────────
import "./styles/global.css";
import "./styles/themes.css";
import "./styles/animations.css";

// ── Apply default theme before first paint ───────────────────
document.documentElement.setAttribute("data-theme", "noir");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
