export type ModelId = "valid" | "invalid";
export type FindingStatus = "pass" | "fail";
export type FindingComparison = "min" | "max";

export type Finding = {
  id: string;
  modelId: ModelId;
  fileName: string;
  status: FindingStatus;
  ruleId: string;
  clause: string;
  title: string;
  description: string;
  elementName: string;
  globalId: string;
  highlightGlobalIds: string[];
  measured: number;
  required: number;
  unit: string;
  comparison: FindingComparison;
};

export type FindingsPayload = {
  generatedAt: string;
  source: string;
  notes: string;
  findings: Finding[];
};
