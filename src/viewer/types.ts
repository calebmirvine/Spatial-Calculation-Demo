import type { Finding, ModelId } from "../compliance/types";

export type LoadStatus = {
  phase: string;
  progress: number;
};

export type ViewerHandle = {
  highlightFinding: (finding: Finding | null) => Promise<void>;
};

export type PickedElement = {
  modelId: ModelId;
  guids: string[];
  inspected: InspectedElement | null;
};

export type InspectedElement = {
  name: string;
  category: string;
  widthMm: number;
  heightMm: number;
  depthMm: number;
  ifcWidthMm?: number;
  ifcHeightMm?: number;
};
