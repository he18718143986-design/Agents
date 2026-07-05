import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { initDebugLog } from "./engine/debugLog";
import { appBasename } from "./router";
import "./index.css";

initDebugLog();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename={appBasename()}>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
