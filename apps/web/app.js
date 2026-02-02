// apps/web/app.js
import { SISAPI } from "./src/api.js";

const api = new SISAPI();
const STORAGE_KEYS = { RUN_LOG: "sis_run_log" };

let lastDiscovery = null;
let lastDecision = null;

// ---------- helpers ----------
function $(id) { return document.getElementById(id); }

function setHidden(el, hidden) {
  if (!el) return;
  el.classList.toggle("hidden", !!hidden);
}

async function copyText(text) {
  if (!text || !text.trim()) return alert("Nothing to copy");
  try { await navigator.clipboard.writeText(text); }
  catch { alert("Copy failed"); }
}

function t(lang, en, es) {
  return (lang === "ES") ? es : en;
}

function safeStr(v) {
  if (v === null || v === undefined) return "";
  return String(v);
}

// ---------- tabs ----------
function switchTab(name) {
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === name);
  });
  document.querySelectorAll(".tab-content").forEach((sec) => {
    sec.classList.toggle("active", sec.id === `${name}-tab`);
  });
}
document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

// ---------- copy buttons ----------
document.querySelectorAll(".copy-btn").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const targetId = btn.dataset.target;
    const el = document.getElementById(targetId);
    const text = el?.textContent || el?.value || "";
    await copyText(text);
  });
});

// ---------- discovery ----------
$("discovery-generate")?.addEventListener("click", async () => {
  try {
    const payload = {
      marketplace: $("discovery-marketplace").value,
      category: $("discovery-category").value.trim(),
      count: Number($("discovery-candidates").value),
      language: $("discovery-language").value,
    };

    const data = await api.discovery(payload);
    lastDiscovery = { payload, data, ts: new Date() };

    const lines = [];
    lines.push(`Marketplace: ${payload.marketplace}`);
    lines.push(`Category: ${payload.category}`);
    lines.push(`Count: ${payload.count}`);
    lines.push("");

    data.candidates.forEach((c, i) => {
      lines.push(`${i + 1}. ${c.product} | ${c.category} | ${c.priceRange} | ${c.signal}`);
    });

    $("discovery-text").textContent = lines.join("\n");
    setHidden($("discovery-output"), false);
  } catch (e) {
    alert(`Discovery failed: ${e.message}`);
  }
});

$("download-discovery-pdf")?.addEventListener("click", () => {
  if (!lastDiscovery?.data?.candidates?.length) return alert("No discovery data");

  const { payload, data, ts } = lastDiscovery;

  if (!window.jspdf || !window.jspdf.jsPDF) return alert("PDF library not loaded");
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF("p", "mm", "a4");

  doc.setFontSize(16);
  doc.text("SIS — Discovery Results", 14, 15);

  doc.setFontSize(10);
  doc.text(`Generated: ${ts.toLocaleString()}`, 14, 22);
  doc.text(`Marketplace: ${payload.marketplace}`, 14, 27);
  doc.text(`Category: ${payload.category}`, 14, 32);
  doc.text(`Count: ${payload.count}`, 14, 37);

  if (typeof doc.autoTable !== "function") return alert("autoTable not loaded");

  doc.autoTable({
    startY: 45,
    head: [["Product", "Category", "Price", "Signal", "Note"]],
    body: data.candidates.map((c) => [c.product, c.category, c.priceRange, c.signal, c.note]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 58, 138] },
    columnStyles: {
      0: { cellWidth: 45 },
      1: { cellWidth: 35 },
      2: { cellWidth: 22 },
      3: { cellWidth: 18 },
      4: { cellWidth: 70 },
    },
  });

  doc.save(`SIS_Discovery_${Date.now()}.pdf`);
});

// ---------- decision ----------
$("decision-generate")?.addEventListener("click", async () => {
  try {
    const payload = {
      url: $("decision-url").value.trim(),
      marketplace: $("decision-marketplace").value,
      capital_profile: $("decision-capital").value,
      product_phase: $("decision-phase").value,
      entry_strategy: $("decision-strategy").value,
      language: $("decision-language").value,
    };

    const data = await api.decision(payload);
    lastDecision = { payload, data, ts: new Date() };

    const lang = payload.language;

    const out = [];
    out.push(`${t(lang, "VERDICT", "VEREDICTO")}: ${data.verdict}`);
    out.push(`${t(lang, "SUMMARY", "RESUMEN")}: ${data.summary}`);
    out.push("");

    if (data.extracted_signals) {
      out.push(t(lang, "EXTRACTED SIGNALS:", "SEÑALES EXTRAÍDAS:"));
      Object.entries(data.extracted_signals).forEach(([k, v]) => out.push(`- ${k}: ${v ?? ""}`));
      out.push("");
    }

    out.push(t(lang, "DISCARD RULES:", "REGLAS DE DESCARTE:"));
    (data.discard_rules_results || []).forEach((r) => {
      out.push(`- ${r.rule}: ${r.passed ? "PASSED" : "FAILED"}${r.reason ? ` | ${r.reason}` : ""}`);
    });

    out.push("");

    if (data.star_score?.components) {
      out.push(`${t(lang, "STAR SCORE", "PUNTUACIÓN")}: ${data.star_score.totalScore}/100`);
      data.star_score.components.forEach((c) => out.push(`- ${c.name}: ${c.score} (${c.weight}%)`));
    }

    $("decision-text").textContent = out.join("\n");
    setHidden($("decision-output"), false);
  } catch (e) {
    alert(`Decision failed: ${e.message}`);
  }
});

// ✅ Professional Decision PDF (no JSON, pro structure)
$("download-decision-pdf")?.addEventListener("click", () => {
  try {
    if (!lastDecision?.data) return alert("No decision data");

    const { payload, data, ts } = lastDecision;
    const lang = payload.language;
    const sig = data.extracted_signals || {};

    if (!window.jspdf || !window.jspdf.jsPDF) return alert("PDF library not loaded");
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF("p", "mm", "a4");

    if (typeof doc.autoTable !== "function") return alert("autoTable not loaded");

    // Header
    doc.setFontSize(16);
    doc.text(t(lang, "Decision Engine Analysis Report", "Reporte de Análisis del Motor de Decisión"), 14, 15);

    doc.setFontSize(10);
    doc.text(`${t(lang, "Date", "Fecha")}: ${ts.toLocaleString()}`, 14, 22);
    doc.text(`${t(lang, "Marketplace", "Marketplace")}: ${payload.marketplace}`, 14, 27);
    doc.text(`${t(lang, "Profile", "Perfil")}: ${payload.capital_profile} / ${payload.product_phase} / ${payload.entry_strategy}`, 14, 32);

    // Verdict big badge
    const verdict = data.verdict || "DISCARDED";
    doc.setFontSize(14);
    doc.text(t(lang, "FINAL VERDICT:", "VEREDICTO FINAL:"), 14, 42);

    doc.setFontSize(20);
    doc.text(verdict, 14, 52);

    // Summary
    doc.setFontSize(11);
    doc.text(t(lang, "Executive Summary", "Resumen Ejecutivo"), 14, 62);
    doc.setFontSize(10);
    const summaryLines = doc.splitTextToSize(`${data.summary || ""}`, 180);
    doc.text(summaryLines, 14, 68);

    let y = 68 + summaryLines.length * 5 + 4;

    // Product Info table (2 columns) — SAFE
    const productRows = [
      [t(lang, "URL", "URL"), safeStr(payload.url)],
      [t(lang, "Title", "Título"), safeStr(sig.title)],
      [t(lang, "Brand", "Marca"), safeStr(sig.brandName)],
      [t(lang, "Category", "Categoría"), safeStr(sig.category)],
      [t(lang, "Price", "Precio"), safeStr(sig.price)],
      [t(lang, "Rating", "Rating"), safeStr(sig.rating)],
      [t(lang, "Reviews", "Reseñas"), safeStr(sig.reviewCount)],
      [t(lang, "BSR", "BSR"), safeStr(sig.bsr)],
      [t(lang, "Competitors (offers)", "Competidores (ofertas)"), safeStr(sig.competitorCount)],
      [t(lang, "Weight (kg)", "Peso (kg)"), safeStr(sig.weightKg)],
    ];

    doc.autoTable({
      startY: y,
      head: [[t(lang, "Product Info", "Información del Producto"), ""]],
      body: productRows,
      styles: { fontSize: 9, cellPadding: 2, overflow: "linebreak" },
      headStyles: { fillColor: [30, 58, 138] },
      columnStyles: {
        0: { cellWidth: 55 },
        1: { cellWidth: 125 },
      },
    });

    y = doc.lastAutoTable.finalY + 8;

    // Discard Rules table
    const dr = data.discard_rules_results || [];
    doc.autoTable({
      startY: y,
      head: [[t(lang, "Discard Rules", "Reglas de Descarte"), t(lang, "Result", "Resultado"), t(lang, "Reason", "Motivo")]],
      body: dr.map(r => [
        r.rule,
        r.passed ? t(lang, "PASS", "APROBADA") : t(lang, "FAIL", "FALLIDA"),
        r.reason || ""
      ]),
      styles: { fontSize: 9, overflow: "linebreak" },
      headStyles: { fillColor: [30, 58, 138] },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { cellWidth: 22 },
        2: { cellWidth: 98 },
      },
    });

    y = doc.lastAutoTable.finalY + 8;

    // Star Score table
    if (data.star_score?.components) {
      const comps = data.star_score.components || [];
      doc.autoTable({
        startY: y,
        head: [[t(lang, "Star Score", "Puntuación"), t(lang, "Score", "Score"), t(lang, "Weight", "Peso"), t(lang, "Explanation", "Explicación")]],
        body: comps.map(c => [c.name, String(c.score), `${c.weight}%`, c.explanation || ""]),
        styles: { fontSize: 9, overflow: "linebreak" },
        headStyles: { fillColor: [30, 58, 138] },
        columnStyles: {
          0: { cellWidth: 35 },
          1: { cellWidth: 18 },
          2: { cellWidth: 20 },
          3: { cellWidth: 117 },
        },
      });
      y = doc.lastAutoTable.finalY + 8;
    }

    // Strategic Recommendation (simple + safe)
    const rec =
      verdict === "APPROVED"
        ? t(lang, "Proceed. Validate differentiation and PPC plan before scaling.", "Proceder. Validar diferenciación y plan de PPC antes de escalar.")
        : verdict === "BORDERLINE"
          ? t(lang, "Validate demand and competition signals. If confirmed, iterate with differentiation.", "Validar demanda y competencia. Si se confirma, iterar con diferenciación.")
          : t(lang, "Avoid for this profile. Risk is too high or critical rule failed.", "Evitar para este perfil. Riesgo alto o falló una regla crítica.");

    doc.setFontSize(11);
    doc.text(t(lang, "Strategic Recommendation", "Recomendación Estratégica"), 14, y);
    doc.setFontSize(10);
    const recLines = doc.splitTextToSize(rec, 180);
    doc.text(recLines, 14, y + 6);

    const asin = data?.request_info?.asin || "";
    const fname = asin ? `SIS_Decision_${asin}.pdf` : `SIS_Decision_${Date.now()}.pdf`;
    doc.save(fname);

  } catch (e) {
    alert(`PDF export failed: ${e.message}`);
  }
});

// ---------- run log ----------
function getLog() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.RUN_LOG) || "[]"); }
  catch { return []; }
}
function setLog(entries) {
  localStorage.setItem(STORAGE_KEYS.RUN_LOG, JSON.stringify(entries));
}
function renderLog() {
  const container = $("log-container");
  const empty = $("empty-log");
  if (!container || !empty) return;

  container.querySelectorAll(".log-entry").forEach((n) => n.remove());

  const entries = getLog();
  if (!entries.length) {
    empty.classList.remove("hidden");
    return;
  }

  empty.classList.add("hidden");

  entries.forEach((e) => {
    const div = document.createElement("div");
    div.className = "log-entry";
    div.innerHTML = `
      <div class="log-entry-header">
        <span class="log-entry-timestamp">${new Date(e.ts).toLocaleString()}</span>
      </div>
      <div class="log-entry-url">${e.url}</div>
      <div class="log-entry-meta">
        <span class="log-tag">${e.marketplace}</span>
        <span class="log-tag">${e.verdict}</span>
      </div>
    `;
    container.appendChild(div);
  });
}

$("save-to-log")?.addEventListener("click", () => {
  if (!lastDecision?.data) return alert("No decision to save");
  const entries = getLog();
  entries.unshift({
    ts: lastDecision.ts.toISOString(),
    url: lastDecision.payload.url,
    marketplace: lastDecision.payload.marketplace,
    verdict: lastDecision.data.verdict,
    summary: lastDecision.data.summary,
    data: lastDecision.data,
  });
  setLog(entries);
  renderLog();
  switchTab("runlog");
});

$("export-log")?.addEventListener("click", () => {
  const entries = getLog();
  const blob = new Blob(
    [JSON.stringify({ exportDate: new Date().toISOString(), entries }, null, 2)],
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
});

$("clear-log")?.addEventListener("click", () => {
  if (!confirm("Clear all log entries?")) return;
  localStorage.removeItem(STORAGE_KEYS.RUN_LOG);
  renderLog();
});

// ---------- About health ----------
(async () => {
  try {
    const h = await api.health();
    const el = $("api-health");
    if (el) el.textContent = h?.ok ? "OK ✅" : "NOT OK";
  } catch {
    const el = $("api-health");
    if (el) el.textContent = "ERROR";
  }
})();

renderLog();
