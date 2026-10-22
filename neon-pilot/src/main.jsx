import React from "react";
import { createRoot } from "react-dom/client";
import { NeonPilot } from "./pilot.jsx";
import "./style.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode><NeonPilot /></React.StrictMode>
);
