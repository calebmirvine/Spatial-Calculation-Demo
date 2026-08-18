import type { Finding, FindingStatus, ModelId } from "./types";

export function modelStatus(findings: Finding[], modelId: ModelId): FindingStatus {
  return findings.some((finding) => finding.modelId === modelId && finding.status === "fail")
    ? "fail"
    : "pass";
}
