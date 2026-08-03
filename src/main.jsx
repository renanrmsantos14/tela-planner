import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { getOrCreateRoot } from "./mountApp";
import "./styles.css";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Mount point #root não encontrado.");

getOrCreateRoot({ host: window, rootElement, createRootFactory: createRoot })
  .render(<React.StrictMode><App /></React.StrictMode>);
