import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/press-start-2p/400.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/600.css";
import "./styles.css";
import App from "./App";

// Отключаем стандартное контекстное меню WebView (у нас своё)
window.addEventListener("contextmenu", (e) => {
  const t = e.target as HTMLElement;
  if (!(t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement)) e.preventDefault();
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
