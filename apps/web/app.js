import { SISAPI } from "./src/api.js";

(function () {
  "use strict";

  const api = new SISAPI("http://127.0.0.1:3001");

  const STORAGE_KEYS = { AUTH: "sis_auth", RUN_LOG: "sis_run_log" };
  let currentDecisionRun = null;
  let lastDiscoveryData = null; // <- guardamos discovery para exportar PDF

  const el = {
    // Login
    loginScreen: document.getElementById("login-screen"),
    loginForm: document.getElementById("login-form"),
    loginEmail: document.getElementById("login-email"),
    loginPassword: document.getElementById("login-password"),

    // App
    app: document.getElementById("app"),
    userEmail: document.getElementById("user-email"),
    logoutBtn: document.getElementById("logout-btn"),

    // Tabs
    tabs: document.querySelectorAll(".tab"),
    tabContents: document.querySelectorAll(".tab-content"),

    // Discovery
    discoveryMarketplace: document.getElementById("discovery-marketplace"),
    discoveryCategory: document.getElementById("discovery-category"),
    discoveryCandidates: document.getElementById("discovery-candidates"),
    discoveryLanguage: document.getElementById("discovery-language"),
    discoveryGenerate: document.getElementById("discovery-generate"),
    discoveryOutput: document.getElementById("discovery-output"),
    discoveryPromptText: document.getElementById("discovery-prompt-text"),
    discoveryInputText: document.getElementById("discovery-input-text"),

    // Decision
    decisionUrl: document.getElementById("decision-url"),
    decisionMarketplace: document.getElementById("decision-marketplace"),
    decisionCapital: document.getElementById("decision-capital"),
    decisionPhase: document.getElementById("decision-phase"),
    decisionStrategy: document.getElementById("decision-strategy"),
    decisionLanguage: document.getElementById("decision-language"),
    decisionGenerate: document.getElementById("decision-generate"),
    decisionOutput: document.getElementById("decision-output"),
    decisionMessageText: document.getElementById("decision-message-text"),
    saveToLog: document.getElementById("save-to-log"),

    // Run Log
    logContainer: document.getElementById("log-container"),
    emptyLog: document.getElementById("empty-log"),
    exportLog: document.getElementById("export-log"),
    clearLog: document.getElementById("clear-log"),

    // Copy buttonsni
    copyBtns: document.querySelectorAll(".copy-btn"),
  };

function downloadDecisionPDF() {
  if (!currentDecisionRun || !currentDecisionRun.result) {
    showToast("No decision data to export", "error");
    return;
  }
  if (!window.jspdf || !window.jspdf.jsPDF) {
    showToast("PDF library not loaded (jsPDF)", "error");
    return;
  }

  const r = currentDecisionRun.result;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF("p", "mm", "a4");

  const asin = currentDecisionRun.result?.request_info?.asin || "";
  const title = "SIS — Decision Report";
  const meta = `Marketplace: ${currentDecisionRun.marketplace} | Phase: ${currentDecisionRun.phase} | Strategy: ${currentDecisionRun.strategy}`;
  const date = `Generated: ${new Date(currentDecisionRun.timestamp).toLocaleString()}`;

  doc.setFontSize(16);
  doc.text(title, 14, 15);

  doc.setFontSize(10);
  doc.text(meta, 14, 22);
  doc.text(date, 14, 27);

  // Verdict block
  doc.setFontSize(12);
  doc.text(`VERDICT: ${r.verdict}`, 14, 36);
  doc.setFontSize(10);
  doc.text(`SUMMARY: ${r.summary}`, 14, 42);

  // Extracted signals
  const sig = r.extracted_signals || {};
  const sigRows = [
    ["Title", sig.title || ""],
    ["Brand", sig.brandName || ""],
    ["Category", sig.category || ""],
    ["Price", sig.price != null ? String(sig.price) : ""],
    ["Rating", sig.rating != null ? String(sig.rating) : ""],
    ["Reviews", sig.reviewCount != null ? String(sig.reviewCount) : ""],
    ["BSR", sig.bsr != null ? String(sig.bsr) : ""],
    ["Competitors (offers)", sig.competitorCount != null ? String(sig.competitorCount) : ""],
    ["Weight (kg)", sig.weightKg != null ? String(sig.weightKg) : ""],
  ];

  doc.autoTable({
    startY: 48,
    head: [["Field", "Value"]],
    body: sigRows,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 58, 138] }
  });

  // Discard rules table
  const dr = r.discard_rules_results || [];
  const drRows = dr.map(x => [
    x.rule,
    x.passed ? "PASSED" : "FAILED",
    x.reason || ""
  ]);

  const yAfterSignals = doc.lastAutoTable.finalY + 8;
  doc.autoTable({
    startY: yAfterSignals,
    head: [["Rule", "Result", "Reason"]],
    body: drRows,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 58, 138] }
  });

  // Star score (if present)
  if (r.star_score && r.star_score.components) {
    const comps = r.star_score.components.map(c => [
      c.name,
      String(c.score),
      `${c.weight}%`,
      c.explanation || ""
    ]);
    const yAfterDR = doc.lastAutoTable.finalY + 8;
    doc.autoTable({
      startY: yAfterDR,
      head: [["Component", "Score", "Weight", "Explanation"]],
      body: comps,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 58, 138] }
    });
  }

  const fname = asin ? `SIS_Decision_${asin}.pdf` : `SIS_Decision_${Date.now()}.pdf`;
  doc.save(fname);
  showToast("PDF downloaded ✅", "success");
}

  // ---------- UI helpers ----------
  function showToast(message, type = "info") {
    const old = document.querySelector(".toast");
    if (old) old.remove();
    const t = document.createElement("div");
    t.className = `toast ${type}`;
    t.textContent = message;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  function setBusy(btn, busy, label) {
    btn.disabled = busy;
    btn.textContent = label;
  }

  function isValidUrl(u) {
    try {
      new URL(u);
      return true;
    } catch {
      return false;
    }
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      showToast("Copied ✅", "success");
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        showToast("Copied ✅", "success");
      } catch {
        showToast("Copy failed", "error");
      }
      document.body.removeChild(ta);
    }
  }

  function markdownTable(headers, rows) {
    const header = `| ${headers.join(" | ")} |`;
    const sep = `| ${headers.map(() => "---").join(" | ")} |`;
    const body = rows.map((r) => `| ${r.join(" | ")} |`).join("\n");
    return [header, sep, body].join("\n");
  }

  // ---------- Auth ----------
  function checkAuth() {
    const a = localStorage.getItem(STORAGE_KEYS.AUTH);
    if (a) {
      const d = JSON.parse(a);
      showApp(d.email);
    } else showLogin();
  }

  function login(email, password) {
    if (email && password && password.length >= 4) {
      localStorage.setItem(
        STORAGE_KEYS.AUTH,
        JSON.stringify({ email, timestamp: new Date().toISOString() })
      );
      showApp(email);
      return true;
    }
    return false;
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEYS.AUTH);
    showLogin();
  }

  function showLogin() {
    el.loginScreen.classList.remove("hidden");
    el.app.classList.add("hidden");
  }

  function showApp(email) {
    el.loginScreen.classList.add("hidden");
    el.app.classList.remove("hidden");
    el.userEmail.textContent = email;
    renderRunLog();
  }

  // ---------- Tabs ----------
  function switchTab(name) {
    el.tabs.forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
    el.tabContents.forEach((c) =>
      c.classList.toggle("active", c.id === `${name}-tab`)
    );
  }

  // ---------- Discovery ----------
  async function runDiscovery() {
    const marketplace = el.discoveryMarketplace.value;
    const category = el.discoveryCategory.value.trim();
    const count = parseInt(el.discoveryCandidates.value, 10);
    const language = el.discoveryLanguage.value;

    if (!category) return showToast("Please enter a category", "error");
    if (!Number.isInteger(count) || count < 5 || count > 50)
      return showToast("Count must be 5–50", "error");

    setBusy(el.discoveryGenerate, true, "Running...");
    try {
      const data = await api.discovery({ marketplace, category, count, language });
      lastDiscoveryData = { marketplace, category, language, generatedAt: new Date(), candidates: data.candidates };

      const headers =
        language === "ES"
          ? ["Producto", "Categoría", "Rango", "Señal", "Nota"]
          : ["Product", "Category", "Price", "Signal", "Note"];

      const rows = data.candidates.map((c) => [
        c.product,
        c.category,
        c.priceRange,
        c.signal,
        c.note,
      ]);

      el.discoveryPromptText.textContent = markdownTable(headers, rows);
      el.discoveryInputText.textContent = JSON.stringify(
        { marketplace, category, count, language },
        null,
        2
      );
      el.discoveryOutput.classList.remove("hidden");
      showToast("Discovery completed", "success");
    } catch (e) {
      showToast(`Discovery failed: ${e.message}`, "error");
    } finally {
      setBusy(el.discoveryGenerate, false, "Run Discovery");
    }
  }

  // ---------- PDF Export (Discovery) ----------
  function downloadDiscoveryPDF() {
    const btn = document.getElementById("download-discovery-pdf");
    if (!lastDiscoveryData || !Array.isArray(lastDiscoveryData.candidates) || lastDiscoveryData.candidates.length === 0) {
      showToast("No discovery data to export", "error");
      return;
    }

    if (!window.jspdf || !window.jspdf.jsPDF) {
      showToast("PDF library not loaded (jsPDF)", "error");
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF("p", "mm", "a4");

    const title = "SIS – Discovery Results";
    const meta = `Marketplace: ${lastDiscoveryData.marketplace} | Category: ${lastDiscoveryData.category}`;
    const date = `Generated: ${lastDiscoveryData.generatedAt.toLocaleString()}`;

    doc.setFontSize(16);
    doc.text(title, 14, 15);

    doc.setFontSize(10);
    doc.text(meta, 14, 22);
    doc.text(date, 14, 27);

    const headers = ["Product", "Category", "Price", "Signal", "Note"];
    const rows = lastDiscoveryData.candidates.map(c => [
      c.product || "",
      c.category || "",
      c.priceRange || "",
      c.signal || "",
      c.note || ""
    ]);

    // autoTable must exist
    if (typeof doc.autoTable !== "function") {
      showToast("PDF table plugin not loaded (autoTable)", "error");
      return;
    }

    doc.autoTable({
      startY: 32,
      head: [headers],
      body: rows,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 58, 138] }
    });

    doc.save(`SIS_Discovery_${Date.now()}.pdf`);
    showToast("PDF downloaded ✅", "success");
  }

  // ---------- Decision ----------
  function genId() {
    return "run_" + Date.now() + "_" + Math.random().toString(36).slice(2, 9);
  }

  async function runDecision() {
    const url = el.decisionUrl.value.trim();
    const marketplace = el.decisionMarketplace.value;
    const capital_profile = el.decisionCapital.value;
    const product_phase = el.decisionPhase.value;
    const entry_strategy = el.decisionStrategy.value;
    const language = el.decisionLanguage.value;

    if (!url) return showToast("Please enter a product URL", "error");
    if (!isValidUrl(url)) return showToast("Please enter a valid URL", "error");

    setBusy(el.decisionGenerate, true, "Running...");
    try {
      const data = await api.decision({
        url,
        marketplace,
        capital_profile,
        product_phase,
        entry_strategy,
        language,
      });

      currentDecisionRun = {
        id: genId(),
        timestamp: new Date().toISOString(),
        url,
        marketplace,
        capital: capital_profile,
        phase: product_phase,
        strategy: entry_strategy,
        language,
        result: data,
        notes: "",
      };

      el.decisionMessageText.value = JSON.stringify(data, null, 2);
      el.decisionOutput.classList.remove("hidden");
      showToast(`Decision: ${data.verdict}`, "success");
    } catch (e) {
      showToast(`Decision failed: ${e.message}`, "error");
    } finally {
      setBusy(el.decisionGenerate, false, "Run Decision");
    }
  }

  // ---------- Run Log ----------
  function getRunLog() {
    const l = localStorage.getItem(STORAGE_KEYS.RUN_LOG);
    return l ? JSON.parse(l) : [];
  }

  function saveRunLog(log) {
    localStorage.setItem(STORAGE_KEYS.RUN_LOG, JSON.stringify(log));
  }

  function addToRunLog() {
    if (!currentDecisionRun || !currentDecisionRun.result)
      return showToast("No run to save", "error");
    const log = getRunLog();
    log.unshift(currentDecisionRun);
    saveRunLog(log);
    renderRunLog();
    showToast("Saved ✅", "success");
    switchTab("runlog");
  }

  function deleteRun(id) {
    const log = getRunLog().filter((e) => e.id !== id);
    saveRunLog(log);
    renderRunLog();
  }

  function updateNotes(id, notes) {
    const log = getRunLog();
    const e = log.find((x) => x.id === id);
    if (e) {
      e.notes = notes;
      saveRunLog(log);
    }
  }

  function renderRunLog() {
    const log = getRunLog();
    const existing = el.logContainer.querySelectorAll(".log-entry");
    existing.forEach((n) => n.remove());

    if (!log.length) {
      el.emptyLog.classList.remove("hidden");
      return;
    }

    el.emptyLog.classList.add("hidden");

    log.forEach((entry) => {
      const div = document.createElement("div");
      div.className = "log-entry";

      const ts = new Date(entry.timestamp).toLocaleString();
      const verdict = entry.result?.verdict || "—";

      div.innerHTML = `
        <div class="log-entry-header">
          <span class="log-entry-timestamp">${ts}</span>
          <button class="btn btn-danger btn-sm">Delete</button>
        </div>
        <div class="log-entry-url">${entry.url}</div>
        <div class="log-entry-meta">
          <span class="log-tag">${entry.marketplace}</span>
          <span class="log-tag">${entry.capital}</span>
          <span class="log-tag">${entry.phase}</span>
          <span class="log-tag">${entry.strategy}</span>
          <span class="log-tag">${entry.language}</span>
          <span class="log-tag">${verdict}</span>
        </div>
        <div class="log-entry-notes">
          <label>Result Notes</label>
          <textarea placeholder="Add notes..." data-id="${entry.id}">${entry.notes || ""}</textarea>
        </div>
      `;

      div.querySelector("button").addEventListener("click", () => {
        deleteRun(entry.id);
        showToast("Deleted", "success");
      });

      div.querySelector("textarea").addEventListener("change", (e) => {
        updateNotes(entry.id, e.target.value);
      });

      el.logContainer.appendChild(div);
    });
  }

  function exportLog() {
    const log = getRunLog();
    if (!log.length) return showToast("No entries to export", "error");

    const blob = new Blob(
      [JSON.stringify({ exportDate: new Date().toISOString(), entries: log }, null, 2)],
      { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sis-run-log-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function clearLog() {
    if (confirm("Clear all log entries?")) {
      localStorage.removeItem(STORAGE_KEYS.RUN_LOG);
      renderRunLog();
      showToast("Cleared", "success");
    }
  }

  // ---------- Copy behavior ----------
  function setupCopyButtons() {
    el.copyBtns.forEach((btn) => {
      btn.addEventListener("click", async () => {
        // If we have a Decision run, copy verdict+summary+json
        if (currentDecisionRun?.result) {
          const r = currentDecisionRun.result;
          const text = [
            `VERDICT: ${r.verdict}`,
            `SUMMARY: ${r.summary}`,
            "",
            "RAW JSON:",
            JSON.stringify(r, null, 2),
          ].join("\n");
          await copyToClipboard(text);
          return;
        }

        // Fallback copy by target element
        const targetId = btn.dataset.target;
        const targetEl = document.getElementById(targetId);
        if (!targetEl) return showToast("Nothing to copy", "error");

        const text =
          targetEl.tagName === "TEXTAREA" ? targetEl.value : targetEl.textContent;
        if (!text || !text.trim()) return showToast("Nothing to copy", "error");

        await copyToClipboard(text);
      });
    });
  }

  // ---------- Init ----------
  function init() {
    // Login
    el.loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = el.loginEmail.value.trim();
      const pw = el.loginPassword.value;
      if (login(email, pw)) el.loginForm.reset();
      else showToast("Invalid credentials. Password must be at least 4 characters.", "error");
    });

    el.logoutBtn.addEventListener("click", logout);

    // Tabs
    el.tabs.forEach((t) => t.addEventListener("click", () => switchTab(t.dataset.tab)));

    // Buttons
    el.discoveryGenerate.textContent = "Run Discovery";
    el.decisionGenerate.textContent = "Run Decision";

    el.discoveryGenerate.addEventListener("click", runDiscovery);
    el.decisionGenerate.addEventListener("click", runDecision);

    el.saveToLog.addEventListener("click", addToRunLog);
    el.exportLog.addEventListener("click", exportLog);
    el.clearLog.addEventListener("click", clearLog);

    // PDF button
    const pdfBtn = document.getElementById("download-discovery-pdf");
    if (pdfBtn) pdfBtn.addEventListener("click", downloadDiscoveryPDF);

    setupCopyButtons();
    checkAuth();
 const decisionPdfBtn = document.getElementById("download-decision-pdf");
if (decisionPdfBtn) decisionPdfBtn.addEventListener("click", downloadDecisionPDF);
 }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

