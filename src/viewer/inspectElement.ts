import type { Finding } from "../compliance/types";
import * as THREE from "three";
import type { FragmentsModel } from "@thatopen/fragments";
import type { InspectedElement } from "./types";

function decodeIfcString(value: string) {
  return value.replace(/\\X2\\([0-9A-Fa-f]{4})\\X0\\/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16)),
  );
}

function attrNumber(data: Record<string, { value?: unknown }>, key: string) {
  const value = data[key]?.value;
  return typeof value === "number" ? value : undefined;
}

function prettyCategory(category: string) {
  const labels: Record<string, string> = {
    IFCDOOR: "Door",
    IFCWINDOW: "Window",
    IFCWALL: "Wall",
    IFCWALLSTANDARDCASE: "Wall",
    IFCSLAB: "Slab",
    IFCROOF: "Roof",
    IFCCOLUMN: "Column",
    IFCBEAM: "Beam",
    IFCSTAIR: "Stair",
    IFCRAILING: "Railing",
    IFCFURNISHINGELEMENT: "Furnishing",
    IFCCOVERING: "Covering",
    IFCPLATE: "Plate",
    IFCMEMBER: "Member",
  };
  return labels[category] ?? category.replace(/^IFC/, "").replace(/STANDARDCASE$/, "");
}

export async function inspectElement(
  model: FragmentsModel,
  localIds: number[],
): Promise<InspectedElement | null> {
  if (localIds.length === 0) return null;
  const id = localIds[0];
  const items = await model.getItems([id]);
  const item = items.get(id);
  const [box] = await model.getBoxes([id]);
  if (!item || !box) return null;

  const size = box.getSize(new THREE.Vector3());
  const nameValue = item.data.Name?.value ?? item.data.ObjectType?.value ?? item.category;
  const name = decodeIfcString(String(nameValue));

  return {
    name,
    category: prettyCategory(item.category),
    widthMm: Math.round(size.x * 1000),
    heightMm: Math.round(size.y * 1000),
    depthMm: Math.round(size.z * 1000),
    ifcWidthMm: attrNumber(item.data, "OverallWidth"),
    ifcHeightMm: attrNumber(item.data, "OverallHeight"),
  };
}

export function inspectFromFinding(
  finding: Finding,
  box?: THREE.Box3 | null,
): InspectedElement {
  const size = box?.getSize(new THREE.Vector3());
  return {
    name: finding.elementName,
    category: finding.title,
    widthMm: size ? Math.round(size.x * 1000) : finding.unit === "mm" ? finding.measured : 0,
    heightMm: size ? Math.round(size.y * 1000) : 0,
    depthMm: size ? Math.round(size.z * 1000) : 0,
    ifcWidthMm: finding.unit === "mm" ? finding.measured : undefined,
  };
}