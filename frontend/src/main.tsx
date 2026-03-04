import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";

if (typeof window !== "undefined" && localStorage.getItem("theme") === "dark") {
  document.documentElement.classList.add("dark");
}

createRoot(document.getElementById("root")!).render(
  <App />,
);
