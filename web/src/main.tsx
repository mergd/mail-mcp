import { StrictMode, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "@fldr/ui/styles/standalone";
import { Consent } from "./pages/Consent";
import { Guide } from "./pages/Guide";
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { Privacy } from "./pages/Privacy";
import { Verify } from "./pages/Verify";

const subscribe = (cb: () => void) => {
  addEventListener("popstate", cb);
  return () => removeEventListener("popstate", cb);
};

function App() {
  const path = useSyncExternalStore(subscribe, () => location.pathname);
  if (path === "/login") return <Login />;
  if (path === "/auth/verify") return <Verify />;
  if (path === "/privacy") return <Privacy />;
  if (path === "/guide") return <Guide />;
  if (path === "/authorize") return <Consent />;
  return <Home />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
