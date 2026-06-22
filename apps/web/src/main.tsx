import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./app/App";
import { LegalView } from "./views/LegalView";
import "./styles/tokens.css";
import "./styles/globals.css";

const path = window.location.pathname.replace(/\/+$/, "");
const legalType = path === "/privacidad" ? "privacy" : path === "/terminos" ? "terms" : null;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {legalType ? <LegalView type={legalType} /> : <App />}
  </React.StrictMode>,
);
