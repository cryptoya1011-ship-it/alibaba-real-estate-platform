import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import App from "./App";
import PublicPropertyPage from "./features/public-property";
import { ThemeProvider, ThemedToaster } from "./state/theme";
import { registerPWA } from "./pwa";
import "./index.css";

// PWA service worker registration (vite-plugin-pwa autoUpdate)
registerPWA();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          {/* Public deep link — no authentication required */}
          <Route path="/p/:code" element={<PublicPropertyPage />} />
          {/* Everything else is the authenticated app */}
          <Route path="*" element={<App />} />
        </Routes>
      </BrowserRouter>
      <ThemedToaster />
    </ThemeProvider>
  </React.StrictMode>,
);
