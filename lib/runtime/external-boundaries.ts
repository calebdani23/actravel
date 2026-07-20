const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

export function areExternalBoundariesDisabled() {
  const value = process.env.E2E_DISABLE_EXTERNAL_BOUNDARIES?.trim().toLowerCase();
  return value ? TRUE_VALUES.has(value) : false;
}

export function externalBoundarySkipReason(boundary: "email" | "google_sheets" | "meta_conversions") {
  const label = {
    email: "Email delivery",
    google_sheets: "Google Sheets sync",
    meta_conversions: "Meta Conversions API",
  }[boundary];

  return `${label} skipped because E2E_DISABLE_EXTERNAL_BOUNDARIES is enabled.`;
}
