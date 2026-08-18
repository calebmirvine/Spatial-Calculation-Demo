import { useEffect, useRef } from "react";
import * as THREE from "three";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import type { Finding, ModelId } from "../compliance/types";
import type { PickedElement, ViewerHandle } from "./types";
import { inspectElement, inspectFromFinding } from "./inspectElement";
import {
  colorPassElements,
  exaggerateFailures,
  frameBox,
  frameOpenings,
  hideRoofs,
  houseBounds,
  overlayBoxForFinding,
  pickOverlay,
} from "./exaggerateOpenings";

type World = OBC.World<OBC.SimpleScene, OBC.SimpleCamera, OBC.SimpleRenderer>;

function toMap(map: OBC.ModelIdMap, modelId: string): OBC.ModelIdMap {
  const ids = map[modelId];
  if (!ids || (ids instanceof Set ? ids.size === 0 : ids.length === 0)) {
    return {};
  }
  return { [modelId]: ids };
}

const overlaySelectMaterial = new THREE.MeshBasicMaterial({
  color: "#2563eb",
  transparent: true,
  opacity: 0.4,
  side: THREE.DoubleSide,
  depthWrite: false,
});

function tintOverlays(group: THREE.Object3D | null, findingId: string | null) {
  if (!group) return;
  group.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    if (!child.userData.baseMaterial) child.userData.baseMaterial = child.material;
    child.material =
      findingId && child.userData.findingId === findingId
        ? overlaySelectMaterial
        : child.userData.baseMaterial;
  });
}

export function useModelWorld(
  containerRef: React.RefObject<HTMLDivElement | null>,
  options: {
    buffer: ArrayBuffer;
    modelId: ModelId;
    failFindings: Finding[];
    passFindings: Finding[];
    focusGuids: string[];
    onReady: (handle: ViewerHandle) => void;
    onPick?: (picked: PickedElement) => void;
  },
) {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    let components: OBC.Components | null = null;
    let fragments: OBC.FragmentsManager | null = null;
    let highlighter: OBF.Highlighter | null = null;
    let world: World | null = null;

    let exaggerated: THREE.Object3D | null = null;
    let canvas: HTMLCanvasElement | null = null;
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const pointerDown = { x: 0, y: 0, armed: false };

    const pickFromEvent = async (event: PointerEvent) => {
      if (disposed || !world) return;
      const target = canvas ?? world.renderer?.three.domElement;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      world.camera.three.updateMatrixWorld();
      raycaster.layers.enableAll();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, world.camera.three);

      if (exaggerated) {
        const hit = pickOverlay(exaggerated, raycaster);
        if (hit) {
          const finding = optionsRef.current.failFindings.find((item) => item.id === hit.findingId);
          tintOverlays(exaggerated, hit.findingId);
          await highlighter?.clear("select");
          const box = overlayBoxForFinding(exaggerated, hit.findingId);
          optionsRef.current.onPick?.({
            modelId: optionsRef.current.modelId,
            guids: finding?.highlightGlobalIds ?? [],
            inspected: finding ? inspectFromFinding(finding, box) : null,
          });
          return;
        }
      }

      tintOverlays(exaggerated, null);
      try {
        await highlighter?.highlight("select", true, false);
      } catch {
        // Clicked empty space.
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      pointerDown.x = event.clientX;
      pointerDown.y = event.clientY;
      pointerDown.armed = true;
    };

    const onPointerUp = (event: PointerEvent) => {
      if (!pointerDown.armed) return;
      pointerDown.armed = false;
      if (event.button !== 0 && event.button !== -1) return;
      if (Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) > 8) {
        return;
      }
      void pickFromEvent(event);
    };

    const onPointerCancel = () => {
      pointerDown.armed = false;
    };

    const start = async () => {
      const { buffer, modelId, failFindings, passFindings, focusGuids } =
        optionsRef.current;
      components = new OBC.Components();
      const worlds = components.get(OBC.Worlds);
      world = worlds.create<OBC.SimpleScene, OBC.SimpleCamera, OBC.SimpleRenderer>();
      world.scene = new OBC.SimpleScene(components);
      world.renderer = new OBC.SimpleRenderer(components, container);
      world.camera = new OBC.SimpleCamera(components);
      world.renderer.showLogo = false;
      world.scene.setup();
      world.scene.three.background = new THREE.Color("#ecece8");
      components.init();

      fragments = components.get(OBC.FragmentsManager);
      fragments.init(await OBC.FragmentsManager.getWorker());
      if (disposed) return;

      world.camera.controls.addEventListener("update", () => {
        if (fragments?.initialized) fragments.core.update();
      });

      fragments.list.onItemSet.add(({ value: model }) => {
        if (!world) return;
        model.useCamera(world.camera.three);
        world.scene.three.add(model.object);
        fragments?.core.update(true);
      });

      components.get(OBC.Raycasters).get(world);
      highlighter = components.get(OBF.Highlighter);
      highlighter.setup({
        world,
        autoHighlightOnClick: false,
        selectMaterialDefinition: {
          color: new THREE.Color("#2563eb"),
          opacity: 1,
          transparent: false,
          renderedFaces: 0,
        },
      });
      highlighter.styles.set("pass", {
        color: new THREE.Color("#1f9d64"),
        opacity: 1,
        transparent: false,
        renderedFaces: 0,
      });
      highlighter.styles.set("fail", {
        color: new THREE.Color("#e85d4c"),
        opacity: 1,
        transparent: false,
        renderedFaces: 0,
      });
      highlighter.zoomToSelection = false;

      const loaded = await fragments.core.load(buffer.slice(0), { modelId });
      if (disposed) return;

      highlighter.events.select.onHighlight.add(async (modelIdMap) => {
        if (!fragments) return;
        const guids = await fragments.modelIdMapToGuids(modelIdMap);
        const localIds = [...(modelIdMap[modelId] ?? [])];
        const inspected = await inspectElement(loaded, localIds);
        optionsRef.current.onPick?.({ modelId, guids, inspected });
      });

      await hideRoofs(loaded);
      const houseBox = await houseBounds(loaded);

      try {
        if (failFindings.length > 0) {
          exaggerated = await exaggerateFailures(
            loaded,
            world.scene.three,
            failFindings,
          );
        } else {
          await colorPassElements(loaded, passFindings);
        }
      } catch (error) {
        console.error("Failed to mark findings in the viewer", error);
      }

      const handle: ViewerHandle = {
        highlightFinding: async (finding) => {
          if (disposed || !fragments?.initialized || !world) return;
          const fromAbove = finding?.ruleId === "VC-DEMO-03";
          try {
            if (highlighter) {
              await highlighter.clear("select");
              await highlighter.clear("pass");
              await highlighter.clear("fail");
            }
            if (!finding) {
              tintOverlays(exaggerated, null);
              await fragments.core.update(true);
              return;
            }

            tintOverlays(exaggerated, finding.id);
            const overlay =
              exaggerated && overlayBoxForFinding(exaggerated, finding.id);
            if (overlay) {
              if (fromAbove) overlay.expandByScalar(4);
              await frameBox(world.camera, overlay, houseBox, { fromAbove });
            } else {
              await frameOpenings(
                loaded,
                world.camera,
                finding.highlightGlobalIds,
                { fromAbove },
              );
            }

            if (highlighter && !overlay) {
              const map = await fragments.guidsToModelIdMap(
                finding.highlightGlobalIds,
              );
              const filtered = toMap(map, modelId);
              if (Object.keys(filtered).length > 0) {
                const style = finding.status === "fail" ? "fail" : "pass";
                await highlighter.highlightByID(style, filtered, true, false);
              }
            }
            await fragments.core.update(true);
          } catch (error) {
            if (!disposed) console.error(error);
          }
        },
      };

      await fragments.core.update(true);
      if (disposed) return;
      canvas = world.renderer.three.domElement;
      canvas.addEventListener("pointerdown", onPointerDown);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerCancel);
      optionsRef.current.onReady(handle);
    };

    start().catch((error) => console.error(error));

    return () => {
      disposed = true;
      canvas?.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      exaggerated?.removeFromParent();
      exaggerated?.traverse((child) => {
        if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
          child.geometry.dispose();
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          for (const material of materials) {
            if (material !== overlaySelectMaterial) material.dispose();
          }
        }
      });
      void highlighter?.dispose().catch(() => undefined);
      fragments?.dispose();
      components?.dispose();
    };
  }, [containerRef, options.buffer, options.modelId]);
}
