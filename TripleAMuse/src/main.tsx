import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "@shared/styles/global.scss";
import "./index.css";
import App from "./App.tsx";
import { AuthProvider } from "@shared";

// Use /muse/ basename on Netlify, / locally
const basename = import.meta.env.PROD ? "/muse" : "/";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename={basename}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
