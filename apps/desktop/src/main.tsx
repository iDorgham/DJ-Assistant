import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { resolveStoredTheme } from "./lib/theme";
import "./index.css";

document.documentElement.dataset.theme = resolveStoredTheme();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
