// services/api/src/engine/rules.js

function norm(str) {
  return (str || "").toString().trim().toLowerCase();
}
function containsAny(h, needles) {
  const s = norm(h);
  return needles.some((n) => s.includes(norm(n)));
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
  const genericWords = ["generic", "unbranded", "no brand", "none", "unknown", "n/a", "na", "oem", "private label"];
  return genericWords.includes(b);
}

// DR-1
export function evalDR1_IP(input) {
  const notes = `${input.title || ""} ${input.brandName || ""} ${input.notes || ""}`;
  if (containsAny(notes, ["patent", "patented", "trademark", "licensed", "copyright"])) {
    return fail("Possible IP/patent signal. Verify manually.");
  }
  return pass();
}

// DR-2
export function evalDR2_Restricted(input) {
  const cat = `${input.category || ""} ${input.mainCategory || ""} ${input.subCategory || ""}`.toLowerCase();
  if (containsAny(cat, ["food", "supplement", "medical", "medical device", "baby safety", "infant safety"])) {
    return fail("Restricted/sensitive category signal detected.");
  }
  if (input.restrictedCategory === true) return fail("Explicit restrictedCategory flag set.");
  return pass();
}

// DR-3 (estricto WL + Conservative)
export function evalDR3_BrandDominance(input, ctx) {
  const brand = (input.brandName || "").trim();
  const reviewCount = Number(input.reviewCount ?? 0);
  const rating = Number(input.rating ?? 0);
  const competitorCount = Number(input.competitorCount ?? 0);

  const phase = ctx.product_phase;
  const strat = ctx.entry_strategy;

  // White Label + Conservative: brand non-generic + moat => FAIL
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

  // Extra safety: entrenched market combo
  if (phase !== "brand" && strat === "conservative") {
    if (competitorCount >= 20 && reviewCount >= 1000) {
      return fail(`Entrenched market: offers=${competitorCount}, reviews=${reviewCount} (conservative).`);
    }
  }

  return pass();
}

// DR-4
export function evalDR4_Margin(input, ctx) {
  const price = Number(input.price ?? 0);
  if (!price || price <= 0) return fail("Missing price from Keepa. Cannot evaluate margin.");

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

// DR-5
export function evalDR5_Logistics(input) {
  if (input.isHazmat === true) return fail("Hazmat flag set.");
  if (input.isFragile === true) return fail("Fragile flag set.");

  const weightKg = Number(input.weightKg ?? 0);
  if (weightKg >= 5) return fail("Oversized/weight risk (>= 5kg).");

  return pass();
}
