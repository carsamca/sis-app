// services/api/src/engine/rules.js

export function applyDiscardRules(signals, context) {
  const results = [];

  // DR-1: Patents / IP risk
  results.push({
    rule: "DR-1: Patents / IP risk",
    passed: true,
    reason: null,
    extra: {}
  });

  // DR-2: Restricted or sensitive category
  results.push({
    rule: "DR-2: Restricted or sensitive category",
    passed: true,
    reason: null,
    extra: {}
  });

  // DR-3: Brand dominance / review moat
  if (
    context.product_phase === "white_label" &&
    context.entry_strategy === "conservative" &&
    signals.brandName &&
    signals.reviewCount &&
    signals.reviewCount > 500
  ) {
    results.push({
      rule: "DR-3: Brand dominance or review moat",
      passed: false,
      reason: `Brand/review moat too strong for White Label + Conservative: brand=${signals.brandName}, reviews=${signals.reviewCount}.`,
      extra: null
    });
    return results;
  }

  results.push({
    rule: "DR-3: Brand dominance or review moat",
    passed: true,
    reason: null,
    extra: {}
  });

  // DR-4: Gross margin viability
  if (!signals.price || !signals.estCogs || !signals.estFees) {
    results.push({
      rule: "DR-4: Gross margin viability",
      passed: false,
      reason: "Missing price from Keepa. Cannot evaluate margin.",
      extra: null
    });
    return results;
  }

  const grossMargin =
    (signals.price - signals.estCogs - signals.estFees) / signals.price;

  if (grossMargin < 0.3) {
    results.push({
      rule: "DR-4: Gross margin viability",
      passed: false,
      reason: `Gross margin too low (${Math.round(grossMargin * 100)}%).`,
      extra: { grossMargin }
    });
    return results;
  }

  results.push({
    rule: "DR-4: Gross margin viability",
    passed: true,
    reason: null,
    extra: {
      grossMargin,
      price: signals.price,
      estCogs: signals.estCogs,
      estFees: signals.estFees
    }
  });

  // DR-5: Logistics risk
  results.push({
    rule: "DR-5: Logistics risk",
    passed: true,
    reason: null,
    extra: {}
  });

  return results;
}
