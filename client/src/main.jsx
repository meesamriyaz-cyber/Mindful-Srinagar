import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { Toaster } from "./components/ui/sonner.jsx";
import { TooltipProvider } from "./components/ui/tooltip.jsx";
import "./styles.css";
import "./styles/design-system.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <TooltipProvider delayDuration={300}>
      <App />
      <Toaster position="top-right" richColors closeButton />
    </TooltipProvider>
  </React.StrictMode>
);
