// apps/web/src/app.js
import { api } from "./api.js";

/* ======================
   HELPERS
====================== */

function uiLanguageToApi(lang) {
  return lang.startsWith("English") ? "EN" : "ES";
}

function uiCapitalToApi(v) {
  return v.toLowerCase(); // Medium -> medium
}

function uiPhaseToApi(v) {
  return v.toLowerCase().replace(" ", "_"); // White Label -> white_label
}

function uiStrategyToApi(v) {
  return v.toLowerCase(); // Conservative -> conservative
}

function showError(message) {
  alert(message);
}

/* ======================
   DISCOVERY
====================== */

document.getElementById("runDiscovery")?.addEventListener("click", async () => {
  try {
    const marketplace = document.getElementById("marketplace").value;
    const category = document.getElementById("category").value;
    const count = Number(
      document.getElementById("numberOfCandidates").value
    );
    const language = uiLanguageToApi(
      document.getElementById("outputLanguage").value
    );

    const payload = {
      marketplace,
      category,
      count,
      language,
    };

    const res = await api.discovery(payload);
    console.log("Discovery OK:", res);
    // aquí sigue tu render de resultados / PDF
  } catch (err) {
    showError(`Discovery failed: ${err.message}`);
  }
});

/* ======================
   DECISION
====================== */

document.getElementById("runDecision")?.addEventListener("click", async () => {
  try {
    const url = document.getElementById("productUrl").value;
    const marketplace = document.getElementById("marketplaceDecision").value;
    const capital_profile = uiCapitalToApi(
      document.getElementById("capitalProfile").value
    );
    const product_phase = uiPhaseToApi(
      document.getElementById("productPhase").value
    );
    const entry_strategy = uiStrategyToApi(
      document.getElementById("entryStrategy").value
    );
    const language = uiLanguageToApi(
      document.getElementById("decisionLanguage").value
    );

    const payload = {
      url, // ⚠️ CLAVE: Decision usa `url`
      marketplace,
      capital_profile,
      product_phase,
      entry_strategy,
      language,
    };

    const res = await api.decision(payload);
    console.log("Decision OK:", res);
    // aquí sigue tu render de veredicto / PDF
  } catch (err) {
    showError(`Decision failed: ${err.message}`);
  }
});
