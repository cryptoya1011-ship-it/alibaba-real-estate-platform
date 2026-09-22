import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import { registerPWA } from "./pwa";

// Register PWA Service Worker (autoUpdate via vite-plugin-pwa)
registerPWA();

// vite-plugin-pwa virtual module for autoUpdate
// @ts-ignore
if (import.meta.env.DEV) {
  // In dev, vite-plugin-pwa still registers if devOptions.enabled=true
  console.log("[PWA] Dev mode — SW enabled via devOptions");
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
