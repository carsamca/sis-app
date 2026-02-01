// apps/web/src/app.js
import { api } from "./api.js";

/* ======================================================
   TEMP: BYPASS LOGIN (INTERNAL TESTING)
====================================================== */
const FORCE_AUTH = true;

/* ======================================================
   HELPERS (UI → API MAPPING)
====================================================== */

function uiLanguageToApi(lang) {
  if (!lang) return "EN";
  return lang.toLowerCase().startsWith("english") ? "EN" : "ES";
}

function uiCapitalToApi(v) {
  if (!v) return "medium";
  return v.toLowerCase(); // Medium -> medium
}

function uiPhaseToApi(v) {
  if (!v) return "white_label";
  return v.toLowerCase().replace(/\s+/g, "_"); // White Label -> white_label
}

function uiStrategyToApi(v) {
  if (!v) return "conservative";
  return v.toLowerCase(); // Conservative -> conservative
}

function showError(message) {
  alert(message);
}

/* ======================================================
   INIT APP (SKIP LOGIN)
====================================================== */

document.addEventListener("DOMContentLoaded", () => {
  if (FORCE_AUTH) {
    console.log("Auth bypass enabled (internal testing)");
    return;
  }
});

/* ======================================================
   DISCOVERY
====================================================== */

const runDiscoveryBtn = document.getElementById("runDiscovery");

runDiscoveryBtn?.addEventListener("click", async () => {
  try {
    const marketplace = document.getElementById("marketplace")?.value;
    const category = document.getElementById("category")?.value;
    const count = Number(
      document.getElementById("numberOfCandidates")?.value || 10
    );
    const language = uiLanguageToApi(
      document.getElementById("outputLanguage")?.value
    );

    const payload = {
      marketplace,
      category,
      count,
      language,
    };

    const res = await api.discovery(payload);
    console.log("Discovery OK:", res);

    // Aquí sigue tu render / PDF
  } catch (err) {
    showError(`Discovery failed: ${err.message}`);
  }
});

/* ======================================================
   DECISION
====================================================== */

const runDecisionBtn = document.getElementById("runDecision");

runDecisionBtn?.addEventListener("click", async () => {
  try {
    const url = document.getElementById("productUrl")?.value;
    const marketplace =
      document.getElementById("marketplaceDecision")?.value || "UK";

    const capital_profile = uiCapitalToApi(
      document.getElementById("capitalProfile")?.value
    );

    const product_phase = uiPhaseToApi(
      document.getElementById("productPhase")?.value
    );

    const entry_strategy = uiStrategyToApi(
      document.getElementById("entryStrategy")?.value
    );

    const language = uiLanguageToApi(
      document.getElementById("decisionLanguage")?.value
    );

    const payload = {
      url, // 🔑 Decision usa `url`
      marketplace,
      capital_profile,
      product_phase,
      entry_strategy,
      language,
    };

    const res = await api.decision(payload);
    console.log("Decision OK:", res);

    // Aquí sigue tu render de veredicto / PDF
  } catch (err) {
    showError(`Decision failed: ${err.message}`);
  }
});
