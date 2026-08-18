import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = existsSync(path.join(root, "public/models/BasicHouse.ifc"))
  ? path.join(root, "public/models/BasicHouse.ifc")
  : path.join(root, "BasicHouse.ifc");
const destDir = path.join(root, "public/models");
const dest = path.join(destDir, "BasicHouseInvalid.ifc");

const DOOR_PREFIX = "#1116859= IFCDOOR('2DedXznHnDaeAWsrTB_q8y'";
const WINDOW_PREFIX = "#19126= IFCWINDOW('2DedXznHnDaeAWsrTB_q8C'";
const ROOM_WALL_BE_LENGTH = "#1609= IFCQUANTITYLENGTH('Length',$,$,3600.);";

await mkdir(destDir, { recursive: true });

const input = createReadStream(source);
const output = createWriteStream(dest);
const rl = readline.createInterface({ input, crlfDelay: Infinity });

let doorPatched = false;
let windowPatched = false;
let roomWallPatched = false;

for await (const line of rl) {
  let next = line;
  if (line.startsWith(DOOR_PREFIX)) {
    next = line.replace(/,2110\.,1010\.\);$/, ",2110.,4200.);");
    doorPatched = next !== line;
  } else if (line.startsWith(WINDOW_PREFIX)) {
    next = line.replace(/,1010\.,1010\.\);$/, ",1010.,4800.);");
    windowPatched = next !== line;
  } else if (line === ROOM_WALL_BE_LENGTH) {
    next = "#1609= IFCQUANTITYLENGTH('Length',$,$,800.);";
    roomWallPatched = true;
  }
  output.write(`${next}\n`);
}

await new Promise((resolve, reject) => {
  output.end(() => resolve(undefined));
  output.on("error", reject);
});

if (!doorPatched || !windowPatched || !roomWallPatched) {
  console.error(
    `Patch incomplete. door=${doorPatched} window=${windowPatched} room=${roomWallPatched}`,
  );
  process.exit(1);
}

console.log(`Wrote ${dest}`);
console.log("  Front facade IFCDOOR #1116859 OverallWidth 1010 → 4200");
console.log("  Front facade IFCWINDOW #19126 OverallWidth 1010 → 4800");
console.log("  Doorless interior wall Length 3600 → 800");
