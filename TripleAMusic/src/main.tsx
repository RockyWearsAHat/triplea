import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "@shared/styles/global.scss";
import "./index.css";
import App from "./App.tsx";
import { AuthProvider } from "@shared";

// Serve at domain root (e.g., https://tripleamusic.com/)
const basename = "/";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename={basename}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
