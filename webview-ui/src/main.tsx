import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import ConfigApp from "./ConfigApp.tsx";

const router = createBrowserRouter([
  {
    path: "/",
    element: <ConfigApp />,
  },
  {
    path: "/config",
    element: <App />,
  },
  { path: "/index.html", element: <ConfigApp /> },
  { path: "*", element: <App /> },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
