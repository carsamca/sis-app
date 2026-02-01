import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";

import health from "./routes/health.js";
import discovery from "./routes/discovery.js";
import decision from "./routes/decision.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.use("/api", health);
app.use("/api", discovery);
app.use("/api", decision);

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ ok: false, error: "Internal server error" });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`SIS API listening on http://127.0.0.1:${PORT}`);
});
