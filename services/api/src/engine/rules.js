import { LEGACY_BRANDS } from "@sis/shared/constants/index.js";

function norm(str) {
  return (str || "").toString().trim().toLowerCase();
}

function containsAny(haystack, needles) {
  const h = norm(haystack);
  return needles.some((n) => h.includes(norm(n)));
}

function pass(extra = {}) {
  return { passed: true, reason: null, extra };
}

function fail(reason) {
  return { passed: false, reason };
}

function isGenericBrand(brandName) {
  const b = norm(brandName);
  if (!b) return true;

  // Treat these as "generic / non-moat" (can extend later)
  const genericWords = [
    "generic",
    "unbranded",
    "no brand",
    "none",
    "unknown",
    "n/a",
    "na",
    "oem",
    "private label"
  ];

  if (genericWords.includes(b)) return true;
  if (containsAny(b, ["store", "official store"])) return false;
  return false;
}

// -----------------------
// DR-1: Patents / IP risk
// -----------------------
export function evalDR1_IP(input) {
  const notes = `${input.title || ""} ${input.brandName || ""} ${input.notes || ""}`;
  if (containsAny(notes, ["patent", "patented", "trademark", "licensed", "copyright"])) {
    return fail("Possible IP/patent signal. Verify manually.");
  }
  return pass();
}

// ------------------------------------------
// DR-2: Restricted or sensitive category
// ------------------------------------------
export function evalDR2_Restricted(input) {
  const cat = `${input.category || ""} ${input.mainCategory || ""} ${input.subCategory || ""}`.toLowerCase();
  if (containsAny(cat, ["food", "supplement", "medical", "medical device", "baby safety", "infant safety"])) {
    return fail("Restricted/sensitive category signal detected.");
  }
  if (input.restrictedCategory === true) return fail("Explicit restrictedCategory flag set.");
  return pass();
}

// ----------------------------------------------------
// DR-3: Brand dominance / Review moat (HARD STOP)
// ----------------------------------------------------
export function evalDR3_BrandDominance(input, ctx) {
  const brand = (input.brandName || "").trim();
  const brandLower = brand.toLowerCase();

  const reviewCount = Number(input.reviewCount ?? 0);
  const rating = Number(input.rating ?? 0);
  const competitorCount = Number(input.competitorCount ?? 0);

  const phase = ctx.product_phase;            // white_label | private_label | brand
  const strat = ctx.entry_strategy;           // conservative | aggressive

  // 1) Hard fail if known legacy brand list and not "brand" phase
  if (brand && LEGACY_BRANDS.map((b) => b.toLowerCase()).includes(brandLower)) {
    if (phase !== "brand") {
      return fail(`Legacy brand dominance (${brand}) is not viable for ${phase}.`);
    }
  }

  // 2) STRICT moat rule for White Label + Conservative:
  // If it's a non-generic brand AND it has a meaningful review moat => FAIL.
  //
  // Thresholds (tune later):
  // - Conservative: >= 800 reviews OR (rating >= 4.6 AND reviews >= 500)
  // This matches your "capital protection" philosophy.
  if (phase === "white_label" && strat === "conservative") {
    if (brand && !isGenericBrand(brand)) {
      if (reviewCount >= 800) {
        return fail(`Brand/review moat too strong for White Label + Conservative: brand=${brand}, reviews=${reviewCount}.`);
      }
      if (rating >= 4.6 && reviewCount >= 500) {
        return fail(`High-trust moat for White Label + Conservative: brand=${brand}, rating=${rating}, reviews=${reviewCount}.`);
      }
    }
  }

  // 3) Private label still cautious (less strict than WL), but protect conservative:
  if (phase === "private_label" && strat === "conservative") {
    if (brand && !isGenericBrand(brand)) {
      if (reviewCount >= 1500) {
        return fail(`Brand/review moat too strong for Private Label + Conservative: brand=${brand}, reviews=${reviewCount}.`);
      }
    }
  }

  // 4) Competition density + moat combo (strategy-aware)
  // If there are many offers and reviews are high, it is usually entrenched.
  if (phase !== "brand") {
    if (competitorCount >= 20 && reviewCount >= 1000 && strat === "conservative") {
      return fail(`Entrenched market: offers=${competitorCount}, reviews=${reviewCount} (conservative).`);
    }
    if (competitorCount >= 30 && reviewCount >= 1500 && strat === "aggressive") {
      return fail(`Entrenched market even for aggressive: offers=${competitorCount}, reviews=${reviewCount}.`);
    }
  }

  return pass();
}

// -----------------------
// DR-4: Margin viability
// -----------------------
export function evalDR4_Margin(input, ctx) {
  const price = Number(input.price ?? 0);
  if (!price || price <= 0) return fail("Missing price. Cannot evaluate margin.");

  // Simple cost model (placeholder)
  const estCogs = Number(input.cogs ?? (price * 0.30));
  const estFees = Number(input.amazonFees ?? input.fees ?? (price * 0.15));

  const grossMargin = (price - estCogs - estFees) / price;

  let min = ctx.entry_strategy === "conservative" ? 0.35 : 0.25;
  if (ctx.capital_profile === "low") min += 0.05;

  if (grossMargin < min) {
    return fail(`Margin too low. Est GM ${(grossMargin * 100).toFixed(1)}% < ${(min * 100).toFixed(1)}%.`);
  }

  return pass({
    grossMargin: Number(grossMargin.toFixed(4)),
    price,
    estCogs: Number(estCogs.toFixed(2)),
    estFees: Number(estFees.toFixed(2))
  });
}

// -----------------------
// DR-5: Logistics risk
// -----------------------
export function evalDR5_Logistics(input) {
  if (input.isHazmat === true) return fail("Hazmat flag set.");
  if (input.isFragile === true) return fail("Fragile flag set.");

  const weightKg = Number(input.weightKg ?? 0);
  if (weightKg >= 5) return fail("Oversized/weight risk (>= 5kg).");

  return pass();
}
