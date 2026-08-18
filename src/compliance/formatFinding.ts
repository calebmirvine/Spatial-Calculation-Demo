import type { Finding } from "./types";

export function formatQuantity(value: number, unit: string) {
  return `${formatNumber(value)} ${unit}`;
}

export function findingLimitLabel(finding: Finding) {
  return finding.comparison === "max" ? "Max allowed" : "Min required";
}

export function findingDeltaText(finding: Finding) {
  const { measured, required, comparison, unit } = finding;
  if (comparison === "max") {
    const over = measured - required;
    if (over > 0) {
      return `${formatQuantity(over, unit)} over · ${formatTimes(measured / required)} the max`;
    }
    if (over < 0) return `${formatQuantity(-over, unit)} under the max`;
    return "Exactly at the max";
  }

  const above = measured - required;
  if (above < 0) {
    const percentBelow = Math.round((1 - measured / required) * 100);
    return `${formatQuantity(-above, unit)} short · ${percentBelow}% below the min`;
  }
  if (above > 0) return `${formatQuantity(above, unit)} above the min`;
  return "Exactly at the min";
}

export function findingMeter(finding: Finding) {
  const span = Math.max(finding.measured, finding.required);
  return {
    fill: span === 0 ? 0 : finding.measured / span,
    mark: span === 0 ? 0 : finding.required / span,
  };
}

function formatNumber(value: number) {
  if (Number.isInteger(value)) return String(value);
  return String(Math.round(value * 100) / 100);
}

function formatTimes(ratio: number) {
  const rounded = Math.round(ratio * 10) / 10;
  return `${Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)}×`;
}
