const MARKETPLACES = ["UK", "USA"];
const LANGUAGES = ["EN", "ES"];
const CAPITAL_PROFILES = ["low", "medium", "high", "scale"];
const PRODUCT_PHASES = ["white_label", "private_label", "brand"];
const ENTRY_STRATEGIES = ["conservative", "aggressive"];

function isOneOf(v, arr) {
  return arr.includes(v);
}

export function validateDiscovery(body) {
  const errors = [];
  if (!body || typeof body !== "object") errors.push("Body must be JSON object.");

  const { marketplace, category, count, language } = body || {};

  if (!isOneOf(marketplace, MARKETPLACES))
    errors.push(`marketplace must be one of: ${MARKETPLACES.join(", ")}`);

  if (!category || typeof category !== "string")
    errors.push("category is required.");

  if (!Number.isInteger(count) || count < 5 || count > 50)
    errors.push("count must be an integer between 5 and 50.");

  if (!isOneOf(language, LANGUAGES))
    errors.push(`language must be one of: ${LANGUAGES.join(", ")}`);

  return { ok: errors.length === 0, errors };
}

export function validateDecision(body) {
  const errors = [];
  if (!body || typeof body !== "object") errors.push("Body must be JSON object.");

  const {
    url,
    marketplace,
    capital_profile,
    product_phase,
    entry_strategy,
    language
  } = body || {};

  if (!url || typeof url !== "string")
    errors.push("url is required.");

  if (!isOneOf(marketplace, MARKETPLACES))
    errors.push(`marketplace must be one of: ${MARKETPLACES.join(", ")}`);

  if (!isOneOf(capital_profile, CAPITAL_PROFILES))
    errors.push(`capital_profile must be one of: ${CAPITAL_PROFILES.join(", ")}`);

  if (!isOneOf(product_phase, PRODUCT_PHASES))
    errors.push(`product_phase must be one of: ${PRODUCT_PHASES.join(", ")}`);

  if (!isOneOf(entry_strategy, ENTRY_STRATEGIES))
    errors.push(`entry_strategy must be one of: ${ENTRY_STRATEGIES.join(", ")}`);

  if (!isOneOf(language, LANGUAGES))
    errors.push(`language must be one of: ${LANGUAGES.join(", ")}`);

  return { ok: errors.length === 0, errors };
}
