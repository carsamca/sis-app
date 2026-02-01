import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import health from "./routes/health.js";
import discovery from "./routes/discovery.js";
import decision from "./routes/decision.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// API routes
app.use("/api", health);
app.use("/api", discovery);
app.use("/api", decision);

// ----------------------------
// Serve frontend from apps/web
// ----------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// server.js está en: services/api/src
// Queremos: apps/web  (desde la raíz del repo)
const webDir = path.resolve(__dirname, "../../../apps/web");

// Sirve estáticos (index.html, app.js, styles.css, logo.png)
app.use(express.static(webDir));

// Root -> index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(webDir, "index.html"));
});

// Fallback (por si refrescas páginas internas)
app.get("*", (req, res) => {
  res.sendFile(path.join(webDir, "index.html"));
});

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ ok: false, error: "Internal server error" });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`SIS API listening on port ${PORT}`);
});
