import "./forceSingleThreadIfc";
import * as OBC from "@thatopen/components";
import { publicUrl } from "./publicUrl";
import type { LoadStatus } from "./types";

export async function convertIfcToFragments(
  url: string,
  onProgress: (status: LoadStatus) => void,
): Promise<ArrayBuffer> {
  onProgress({ phase: "Starting converter", progress: 0.02 });

  const components = new OBC.Components();
  components.init();
  const fragments = components.get(OBC.FragmentsManager);
  fragments.init(await OBC.FragmentsManager.getWorker());

  const ifcLoader = components.get(OBC.IfcLoader);
  await ifcLoader.setup({
    autoSetWasm: false,
    wasm: { path: publicUrl("wasm/"), absolute: true },
  });

  onProgress({ phase: "Fetching BasicHouse.ifc", progress: 0.08 });
  const data = new Uint8Array(await (await fetch(url)).arrayBuffer());

  const model = await ifcLoader.load(data, false, "source", {
    processData: {
      progressCallback: (progress) => {
        onProgress({
          phase: "Converting IFC to fragments",
          progress: 0.1 + progress * 0.85,
        });
      },
    },
  });

  const buffer = await model.getBuffer();
  fragments.dispose();
  components.dispose();
  onProgress({ phase: "Ready", progress: 1 });
  return buffer;
}
