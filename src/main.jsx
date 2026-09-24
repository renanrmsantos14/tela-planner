import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { getOrCreateRoot, hasReactRoot } from "./mountApp";
import "./styles.css";

if (window.parent === window && /\.crm\d*\.dynamics\.com$/i.test(window.location.hostname)) {
  const params = new URLSearchParams({
    pagetype: "webresource",
    webresourceName: "new_TelaPlanner.html",
  });
  const data = new URLSearchParams(window.location.search).get("data");
  if (data) params.set("data", data);
  window.location.replace(`${window.location.origin}/main.aspx?${params}`);
} else {
  const rootElement = document.getElementById("root");
  if (!rootElement) throw new Error("Mount point #root não encontrado.");

  if (!hasReactRoot(rootElement)) {
    getOrCreateRoot({ host: window, rootElement, createRootFactory: createRoot })
      .render(<React.StrictMode><App /></React.StrictMode>);
  }
}
