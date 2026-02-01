import fetch from "node-fetch";

/**
 * Keepa Client (robust extraction: price + reviews/rating + offerCount)
 * Requires:
 *   KEEPA_API_KEY=xxxxxxxx
 */

const DOMAIN_ID = { USA: 1, UK: 2 };

export function asinFromUrl(url) {
  const u = (url || "").trim();
  const m =
    u.match(/\/dp\/([A-Z0-9]{10})/i) ||
    u.match(/\/gp\/product\/([A-Z0-9]{10})/i) ||
    u.match(/asin=([A-Z0-9]{10})/i);
  return m ? m[1].toUpperCase() : null;
}

function keepaPriceToNumber(p) {
  if (p == null) return null;
  const n = Number(p);
  if (!Number.isFinite(n) || n < 0) return null;
  return n / 100;
}

/**
 * Keepa CSV arrays are usually pairs: [time, value, time, value, ...]
 * Return LAST valid value (>=0) converted.
 */
function lastValidFromCsv(csvArr, convertFn = (v) => v) {
  if (!Array.isArray(csvArr) || csvArr.length < 2) return null;
  for (let i = csvArr.length - 1; i >= 1; i -= 2) {
    const v = Number(csvArr[i]);
    if (Number.isFinite(v) && v >= 0) return convertFn(v);
  }
  return null;
}

export async function fetchKeepaProduct({ marketplace, asin, stats = 90 }) {
  const key = process.env.KEEPA_API_KEY || process.env.KEEPA_KEY;
  if (!key) throw new Error("Missing KEEPA_API_KEY env var.");

  const domainId = marketplace === "UK" ? DOMAIN_ID.UK : DOMAIN_ID.USA;

  const params = new URLSearchParams({
    key,
    domain: String(domainId),
    asin,
    stats: String(stats),
    history: "1", // needed for csv fallbacks
    rating: "1",
  });

  const url = `https://api.keepa.com/product?${params.toString()}`;
  const res = await fetch(url);

  if (!res.ok) throw new Error(`Keepa HTTP ${res.status}`);
  const data = await res.json();
  const product = data?.products?.[0];
  if (!product) throw new Error("Keepa: product not found for ASIN.");

  return product;
}

export function extractSignalsFromKeepa(product) {
  const title = product.title || null;
  const brandName = product.brand || product.manufacturer || null;

  let category = null;
  if (Array.isArray(product.categoryTree) && product.categoryTree.length) {
    category = product.categoryTree[product.categoryTree.length - 1]?.name || null;
  }

  // -----------------------------
  // PRICE (robust)
  // -----------------------------
  let price = null;

  // 1) BuyBox price (best)
  if (product.stats?.buyBoxPrice != null) {
    price = keepaPriceToNumber(product.stats.buyBoxPrice);
  }

  // 2) Try stats.current candidates
  if (!price && Array.isArray(product.stats?.current)) {
    const candidates = [
      product.stats.current[0],  // Amazon price (often)
      product.stats.current[1],  // New price (often)
      product.stats.current[18], // sometimes buybox-like
    ];
    for (const c of candidates) {
      const p = keepaPriceToNumber(c);
      if (p != null) { price = p; break; }
    }
  }

  // 3) CSV fallback (last valid)
  if (!price && Array.isArray(product.csv)) {
    const csvCandidates = [product.csv[18], product.csv[0], product.csv[1]];
    for (const arr of csvCandidates) {
      const p = lastValidFromCsv(arr, (v) => keepaPriceToNumber(v));
      if (p != null) { price = p; break; }
    }
  }

  // -----------------------------
  // RATING / REVIEWS (robust)
  // -----------------------------
  // Keepa commonly stores rating as rating*10 (e.g. 45 => 4.5)
  let rating = null;
  if (product.stats?.rating != null) rating = Number(product.stats.rating) / 10;
  if (!rating && product.rating != null) {
    // sometimes already 0-50 or 0-5 depending on endpoint; normalize best effort
    const r = Number(product.rating);
    if (Number.isFinite(r)) rating = r > 5 ? r / 10 : r;
  }

  let reviewCount = null;
  if (product.stats?.reviewCount != null) reviewCount = Number(product.stats.reviewCount);
  if ((reviewCount == null || Number.isNaN(reviewCount)) && product.reviewCount != null) {
    const rc = Number(product.reviewCount);
    if (Number.isFinite(rc)) reviewCount = rc;
  }

  // optional: CSV fallbacks if present (some accounts/domains may include)
  if (!rating && Array.isArray(product.csv) && product.csv[16]) {
    // heurística: algunos datasets guardan rating history en ciertos índices
    const r = lastValidFromCsv(product.csv[16], (v) => Number(v) / 10);
    if (r != null) rating = r;
  }
  if ((reviewCount == null || Number.isNaN(reviewCount)) && Array.isArray(product.csv) && product.csv[17]) {
    const rc = lastValidFromCsv(product.csv[17], (v) => Number(v));
    if (rc != null) reviewCount = rc;
  }

  // -----------------------------
  // SALES RANK / BSR (best effort)
  // -----------------------------
  let bsr = null;
  if (Array.isArray(product.stats?.current)) {
    const maybe = product.stats.current[3];
    if (Number.isFinite(maybe) && maybe > 0) bsr = Number(maybe);
  }
  if (!bsr && product.stats?.salesRank != null) {
    const r = Number(product.stats.salesRank);
    if (Number.isFinite(r) && r > 0) bsr = r;
  }
  // CSV fallback: sales rank history sometimes at csv[3] depending on category mapping
  if (!bsr && Array.isArray(product.csv) && product.csv[3]) {
    const r = lastValidFromCsv(product.csv[3], (v) => Number(v));
    if (r != null && r > 0) bsr = r;
  }

  // -----------------------------
  // OFFER COUNT / COMPETITION (robust)
  // -----------------------------
  let competitorCount = null;

  if (product.stats?.offerCount != null) competitorCount = Number(product.stats.offerCount);
  if ((competitorCount == null || Number.isNaN(competitorCount)) && product.offerCount != null) {
    const oc = Number(product.offerCount);
    if (Number.isFinite(oc)) competitorCount = oc;
  }

  // fallback: sometimes offer count is placed in stats.current in some datasets
  if ((competitorCount == null || Number.isNaN(competitorCount)) && Array.isArray(product.stats?.current)) {
    // try a couple of candidate indices (best effort)
    const candidates = [product.stats.current[11], product.stats.current[12]];
    for (const c of candidates) {
      const oc = Number(c);
      if (Number.isFinite(oc) && oc >= 0) { competitorCount = oc; break; }
    }
  }

  // -----------------------------
  // WEIGHT (best effort)
  // -----------------------------
  let weightKg = null;
  if (product.packageWeight != null) {
    const w = Number(product.packageWeight);
    if (Number.isFinite(w) && w > 0) weightKg = w > 100 ? w / 1000 : w;
  }

  return {
    title,
    brandName,
    category,
    price,
    rating,
    reviewCount,
    bsr,
    competitorCount,
    weightKg
  };
}
