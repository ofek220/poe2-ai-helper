import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import App from "./components/App";
import "./styles/index.css";
import { BrowserRouter } from "react-router-dom";

ReactDOM.createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter basename="/poe2-ai-helper">
      <App />
    </BrowserRouter>
  </StrictMode>,
);
