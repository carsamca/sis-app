import express from "express";
import { validateDecision } from "../../schemas/index.js";
import { runDecision } from "../engine/module2.js";

const router = express.Router();

router.post("/decision", async (req, res) => {
  const v = validateDecision(req.body);
  if (!v.ok) return res.status(400).json({ ok: false, errors: v.errors });

  const {
    url,
    marketplace,
    capital_profile,
    product_phase,
    entry_strategy,
    language
  } = req.body;

  const result = await runDecision({
    url,
    marketplace,
    capital_profile,
    product_phase,
    entry_strategy,
    language
  });

  res.json(result);
});

export default router;
