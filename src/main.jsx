import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { getOrCreateRoot, hasReactRoot } from "./mountApp";
import "./styles.css";
import "./shadcn.css";
import "./shadcn-overrides.css";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Mount point #root não encontrado.");

if (!hasReactRoot(rootElement)) {
  getOrCreateRoot({ host: window, rootElement, createRootFactory: createRoot })
    .render(<React.StrictMode><App /></React.StrictMode>);
}
