import { createReadStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const MAX_EXTERIOR_DOOR_WIDTH_MM = 1200;
const MAX_WINDOW_WIDTH_MM = 1500;
const MIN_ROOM_AREA_M2 = 9.8;
const TARGET_DOOR_GUID = "2DedXznHnDaeAWsrTB_q8y";
const TARGET_WINDOW_GUID = "2DedXznHnDaeAWsrTB_q8C";
const ROOM_WALL_GUID = "2DedXznHnDaeAWsrTB_qBe";
const ROOM_SPAN_GUID = "2DedXznHnDaeAWsrTB_qBh";

const models = [
  {
    modelId: "valid",
    fileName: "BasicHouse.ifc",
    path: path.join(root, "public/models/BasicHouse.ifc"),
  },
  {
    modelId: "invalid",
    fileName: "BasicHouseInvalid.ifc",
    path: path.join(root, "public/models/BasicHouseInvalid.ifc"),
  },
];

function decodeIfcString(value) {
  return value.replace(/\\X2\\([0-9A-Fa-f]{4})\\X0\\/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16)),
  );
}

function roundArea(value) {
  return Math.round(value * 100) / 100;
}

async function parseIfc(filePath) {
  const doors = [];
  const windows = [];
  const roomWallLengths = {};
  let pendingRoomWall = null;
  const rl = readline.createInterface({
    input: createReadStream(filePath),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (line.startsWith("#") && line.includes("= IFCDOOR(")) {
      const match = line.match(
        /^#(\d+)= IFCDOOR\('([^']+)',#[^,]+,'((?:\\'|[^'])*)',[\s\S]*,'([^']*)',(-?[0-9.]+),(-?[0-9.]+)\);\s*$/,
      );
      if (!match) continue;
      doors.push({
        globalId: match[2],
        name: decodeIfcString(match[3]),
        overallWidth: Number(match[6]),
      });
    } else if (line.startsWith("#") && line.includes("= IFCWINDOW(")) {
      const match = line.match(
        /^#(\d+)= IFCWINDOW\('([^']+)',#[^,]+,'((?:\\'|[^'])*)',[\s\S]*,'([^']*)',(-?[0-9.]+),(-?[0-9.]+)\);\s*$/,
      );
      if (!match) continue;
      windows.push({
        globalId: match[2],
        name: decodeIfcString(match[3]),
        overallWidth: Number(match[6]),
      });
    } else if (line.startsWith("#") && line.includes("= IFCWALLSTANDARDCASE(")) {
      const match = line.match(/^#\d+= IFCWALLSTANDARDCASE\('([^']+)'/);
      pendingRoomWall =
        match && (match[1] === ROOM_WALL_GUID || match[1] === ROOM_SPAN_GUID)
          ? match[1]
          : null;
    } else if (
      pendingRoomWall &&
      line.includes("= IFCQUANTITYLENGTH('Length'")
    ) {
      const match = line.match(
        /IFCQUANTITYLENGTH\('Length',\$,\$,([0-9.]+)\);/,
      );
      if (match) {
        roomWallLengths[pendingRoomWall] = Number(match[1]);
        pendingRoomWall = null;
      }
    }
  }

  return { doors, windows, roomWallLengths };
}

const findings = [];

for (const model of models) {
  const { doors, windows, roomWallLengths } = await parseIfc(model.path);
  const door = doors.find((item) => item.globalId === TARGET_DOOR_GUID);
  const window = windows.find((item) => item.globalId === TARGET_WINDOW_GUID);
  const lengthA = roomWallLengths[ROOM_WALL_GUID];
  const lengthB = roomWallLengths[ROOM_SPAN_GUID];

  if (!door || !window || !lengthA || !lengthB) {
    throw new Error(`Missing target entities in ${model.fileName}`);
  }

  const roomArea = roundArea((lengthA * lengthB) / 1e6);

  findings.push({
    id: `${model.modelId}-exterior-door`,
    modelId: model.modelId,
    fileName: model.fileName,
    status: door.overallWidth <= MAX_EXTERIOR_DOOR_WIDTH_MM ? "pass" : "fail",
    ruleId: "VC-DEMO-01",
    clause: "Project rule — max single-leaf exterior door",
    title: "Exterior door width",
    description:
      "Exterior single-swing door leaves shall not exceed 1200 mm.",
    elementName: "Exterior door D10",
    globalId: door.globalId,
    highlightGlobalIds: [door.globalId],
    measured: door.overallWidth,
    required: MAX_EXTERIOR_DOOR_WIDTH_MM,
    unit: "mm",
    comparison: "max",
  });

  findings.push({
    id: `${model.modelId}-window-width`,
    modelId: model.modelId,
    fileName: model.fileName,
    status: window.overallWidth <= MAX_WINDOW_WIDTH_MM ? "pass" : "fail",
    ruleId: "VC-DEMO-02",
    clause: "Project rule — max window opening width",
    title: "Window width",
    description:
      "A single window opening shall not exceed 1500 mm in width.",
    elementName: "Front window 10x10",
    globalId: window.globalId,
    highlightGlobalIds: [window.globalId],
    measured: window.overallWidth,
    required: MAX_WINDOW_WIDTH_MM,
    unit: "mm",
    comparison: "max",
  });

  findings.push({
    id: `${model.modelId}-room-area`,
    modelId: model.modelId,
    fileName: model.fileName,
    status: roomArea >= MIN_ROOM_AREA_M2 ? "pass" : "fail",
    ruleId: "VC-DEMO-03",
    clause: "Project rule — min habitable room area",
    title: "Room area",
    description:
      "A habitable room shall provide at least 9.8 m² of floor area.",
    elementName: "East living room",
    globalId: ROOM_WALL_GUID,
    highlightGlobalIds: [ROOM_WALL_GUID],
    measured: roomArea,
    required: MIN_ROOM_AREA_M2,
    unit: "m²",
    comparison: "min",
  });
}

const payload = {
  generatedAt: new Date().toISOString(),
  source: "scripts/check-ifc.mjs",
  notes:
    "Semantic IFC attribute checks only. Geometry tessellation is unchanged. Thresholds are simplified demo rules, not a complete code review. Room area is the product of the doorless interior wall Length and the spanning wall Length because this export has no IFCSPACE entities.",
  findings,
};

const outDir = path.join(root, "public/compliance");
await mkdir(outDir, { recursive: true });
const outPath = path.join(outDir, "findings.json");
await writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Wrote ${outPath} (${findings.length} findings)`);
for (const finding of findings) {
  console.log(
    `  [${finding.status.toUpperCase()}] ${finding.modelId} ${finding.title}: ${finding.measured}${finding.unit} (${finding.comparison} ${finding.required}${finding.unit})`,
  );
}
