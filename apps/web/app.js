// apps/web/app.js
import { SISAPI } from "./src/api.js";

const api = new SISAPI();

const STORAGE_KEYS = { RUN_LOG: "sis_run_log" };

let lastDiscovery = null;
let lastDecision = null;

// ---------- helpers ----------
function $(id) { return document.getElementById(id); }

function showToast(msg) {
  // Simple: console + alert fallback
  console.log(msg);
}

function setHidden(el, hidden) {
  if (!el) return;
  el.classList.toggle("hidden", !!hidden);
}

function downloadPDF(title, metaLines, tables) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF("p", "mm", "a4");

  doc.setFontSize(16);
  doc.text(title, 14, 15);

  doc.setFontSize(10);
  let y = 22;
  metaLines.forEach(line => { doc.text(line, 14, y); y += 5; });

  let startY = y + 3;
  tables.forEach((t) => {
    doc.autoTable({
      startY,
      head: [t.head],
      body: t.body,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 58, 138] }
    });
    startY = doc.lastAutoTable.finalY + 8;
  });

  doc.save(`${title.replace(/\s+/g, "_")}_${Date.now()}.pdf`);
}

// ---------- tabs ----------
function switchTab(name) {
  document.querySelectorAll(".tab").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === name);
  });
  document.querySelectorAll(".tab-content").forEach(sec => {
    sec.classList.toggle("active", sec.id === `${name}-tab`);
  });
}

document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

// ---------- copy buttons ----------
document.querySelectorAll(".copy-btn").forEach(btn => {
  btn.addEventListener("click", async () => {
    const targetId = btn.dataset.target;
    const el = document.getElementById(targetId);
    const text = el?.textContent || "";
    if (!text.trim()) return alert("Nothing to copy");
    try {
      await navigator.clipboard.writeText(text);
      showToast("Copied ✅");
    } catch {
      alert("Copy failed");
    }
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

  downloadPDF(
    "SIS Discovery Results",
    [
      `Generated: ${ts.toLocaleString()}`,
      `Marketplace: ${payload.marketplace}`,
      `Category: ${payload.category}`,
      `Count: ${payload.count}`,
    ],
    [{
      head: ["Product", "Category", "Price", "Signal", "Note"],
      body: data.candidates.map(c => [c.product, c.category, c.priceRange, c.signal, c.note]),
    }]
  );
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

    // Human-readable output
    const out = [];
    out.push(`VERDICT: ${data.verdict}`);
    out.push(`SUMMARY: ${data.summary}`);
    out.push("");
    if (data.extracted_signals) {
      out.push("EXTRACTED:");
      Object.entries(data.extracted_signals).forEach(([k, v]) => out.push(`- ${k}: ${v ?? ""}`));
      out.push("");
    }
    out.push("DISCARD RULES:");
    (data.discard_rules_results || []).forEach(r => {
      out.push(`- ${r.rule}: ${r.passed ? "PASSED" : "FAILED"}${r.reason ? ` | ${r.reason}` : ""}`);
    });
    out.push("");
    if (data.star_score?.components) {
      out.push(`STAR SCORE: ${data.star_score.totalScore}/100`);
      data.star_score.components.forEach(c => out.push(`- ${c.name}: ${c.score} (${c.weight}%)`));
    }

    $("decision-text").textContent = out.join("\n");
    setHidden($("decision-output"), false);
  } catch (e) {
    alert(`Decision failed: ${e.message}`);
  }
});

$("download-decision-pdf")?.addEventListener("click", () => {
  if (!lastDecision?.data) return alert("No decision data");

  const { payload, data, ts } = lastDecision;
  const sig = data.extracted_signals || {};

  if (!window.jspdf || !window.jspdf.jsPDF) {
    return alert("PDF library not loaded");
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF("p", "mm", "a4");

  // ===== HEADER =====
  doc.setFontSize(16);
  doc.text("Análisis de Producto Candidato", 14, 15);

  doc.setFontSize(10);
  doc.text(`Fecha: ${ts.toLocaleString()}`, 14, 22);
  doc.text(`Marketplace: ${payload.marketplace}`, 14, 27);
  doc.text(`Fase: ${payload.product_phase}`, 14, 32);
  doc.text(`Estrategia: ${payload.entry_strategy}`, 14, 37);

  // ===== VERDICT =====
  doc.setFontSize(12);
  doc.text(`VEREDICTO: ${data.verdict}`, 14, 45);

  const summaryLines = doc.splitTextToSize(
    `RESUMEN: ${data.summary}`,
    180
  );
  doc.setFontSize(10);
  doc.text(summaryLines, 14, 52);

  let y = 52 + summaryLines.length * 5 + 4;

  // ===== DATOS DEL PRODUCTO (texto normal, NO tabla) =====
  doc.setFontSize(11);
  doc.text("Datos del producto", 14, y);
  y += 6;

  doc.setFontSize(9);

  const rows = [
    ["URL", payload.url],
    ["Título", sig.title || ""],
    ["Marca", sig.brandName || ""],
    ["Categoría", sig.category || ""],
    ["Precio", sig.price ?? ""],
    ["Rating", sig.rating ?? ""],
    ["Reviews", sig.reviewCount ?? ""],
    ["BSR", sig.bsr ?? ""],
    ["Competidores", sig.competitorCount ?? ""],
    ["Peso (kg)", sig.weightKg ?? ""],
  ];

  rows.forEach(([label, value]) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }

    doc.setFont(undefined, "bold");
    doc.text(`${label}:`, 14, y);

    doc.setFont(undefined, "normal");
    const valueLines = doc.splitTextToSize(String(value), 150);
    doc.text(valueLines, 45, y);

    y += Math.max(5, valueLines.length * 4);
  });

  // ===== REGLAS DE DESCARTE =====
  doc.autoTable({
    startY: y + 6,
    head: [["Regla", "Resultado", "Motivo"]],
    body: (data.discard_rules_results || []).map(r => [
      r.rule,
      r.passed ? "APROBADA" : "FALLIDA",
      r.reason || ""
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 58, 138] }
  });

  // ===== STAR SCORE =====
  if (data.star_score?.components) {
    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 8,
      head: [["Componente", "Score", "Peso", "Explicación"]],
      body: data.star_score.components.map(c => [
        c.name,
        String(c.score),
        `${c.weight}%`,
        c.explanation || ""
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 58, 138] }
    });
  }

  doc.save(`Analisis_Producto_${Date.now()}.pdf`);
});

  downloadPDF(
    "SIS Decision Report",
    [
      `Generated: ${ts.toLocaleString()}`,
      `Marketplace: ${payload.marketplace}`,
      `Phase: ${payload.product_phase}`,
      `Strategy: ${payload.entry_strategy}`,
    ],
    [
      {
        head: ["Field", "Value"],
        body: [
          ["URL", payload.url],
          ["Verdict", data.verdict],
          ["Summary", data.summary],
          ["Title", sig.title || ""],
          ["Brand", sig.brandName || ""],
          ["Category", sig.category || ""],
          ["Price", sig.price ?? ""],
          ["Rating", sig.rating ?? ""],
          ["Reviews", sig.reviewCount ?? ""],
          ["BSR", sig.bsr ?? ""],
          ["Competitors", sig.competitorCount ?? ""],
          ["WeightKg", sig.weightKg ?? ""],
        ],
      },
      {
        head: ["Rule", "Result", "Reason"],
        body: (data.discard_rules_results || []).map(r => [
          r.rule,
          r.passed ? "PASSED" : "FAILED",
          r.reason || ""
        ]),
      },
      ...(data.star_score?.components ? [{
        head: ["Component", "Score", "Weight", "Explanation"],
        body: data.star_score.components.map(c => [c.name, String(c.score), `${c.weight}%`, c.explanation || ""]),
      }] : [])
    ]
  );
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

  container.querySelectorAll(".log-entry").forEach(n => n.remove());

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
  const blob = new Blob([JSON.stringify({ exportDate: new Date().toISOString(), entries }, null, 2)], { type: "application/json" });
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
    $("api-health").textContent = h?.ok ? "OK ✅" : "NOT OK";
  } catch {
    $("api-health").textContent = "ERROR";
  }
})();

renderLog();
