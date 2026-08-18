import * as THREE from "three";
import type { FragmentsModel } from "@thatopen/fragments";
import type { Finding } from "../compliance/types";

const ROOM_RULE_ID = "VC-DEMO-03";
const FLOOR_GUID = "1kRPPrPK119PBys6QizWFs";
const ROOM_WALL_GUID = "2DedXznHnDaeAWsrTB_qBe";
const ROOM_SPAN_GUID = "2DedXznHnDaeAWsrTB_qBh";
const ROOM_GAP_M = 0.8;
const PASS_COLOR = "#1f9d64";
const FAIL_COLOR = "#e85d4c";
const ROOF_GUIDS = [
  "1yETHMphv6LwABqR8Pbs5g",
  "1yETHMphv6LwABqR0Pbs5g",
  "1yETHMphv6LwABqR4Pbs5g",
];

export async function hideRoofs(model: FragmentsModel) {
  const fromGuids = (await model.getLocalIdsByGuids(ROOF_GUIDS)).filter(
    (id): id is number => id !== null,
  );
  const byCategory = await model.getItemsOfCategories([/IFCROOF/]);
  const fromCategory = Object.values(byCategory).flat();
  const localIds = [...new Set([...fromGuids, ...fromCategory])];
  if (localIds.length > 0) await model.setVisible(localIds, false);
}

export async function colorPassElements(model: FragmentsModel, findings: Finding[]) {
  const guids = [...new Set(findings.flatMap((finding) => finding.highlightGlobalIds))];
  const localIds = (await model.getLocalIdsByGuids(guids)).filter(
    (id): id is number => id !== null,
  );
  if (localIds.length > 0) await model.setColor(localIds, new THREE.Color(PASS_COLOR));
}

export async function exaggerateFailures(
  model: FragmentsModel,
  scene: THREE.Scene,
  findings: Finding[],
) {
  const group = new THREE.Group();
  group.name = "exaggerated-failures";
  const wallMaterial = new THREE.MeshLambertMaterial({
    color: FAIL_COLOR,
    transparent: true,
    opacity: 0.92,
  });

  const openingFindings = findings.filter((finding) => finding.ruleId !== ROOM_RULE_ID);
  const roomFindings = findings.filter((finding) => finding.ruleId === ROOM_RULE_ID);

  await addOpeningCuts(model, group, openingFindings);
  await moveRoomWalls(model, group, wallMaterial, roomFindings);

  scene.add(group);
  group.updateMatrixWorld(true);
  return group;
}

async function addOpeningCuts(
  model: FragmentsModel,
  group: THREE.Group,
  findings: Finding[],
) {
  const fill = new THREE.MeshBasicMaterial({
    color: FAIL_COLOR,
    transparent: true,
    opacity: 0.22,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const line = new THREE.LineBasicMaterial({ color: FAIL_COLOR });
  const widthScale = 1.4;
  const heightScale = 1.12;

  for (const finding of findings) {
    const localIds = (await model.getLocalIdsByGuids(finding.highlightGlobalIds)).filter(
      (id): id is number => id !== null,
    );
    if (localIds.length === 0) continue;

    await model.setVisible(localIds, false);
    const boxes = await model.getBoxes(localIds);

    for (let i = 0; i < localIds.length; i += 1) {
      const box = boxes[i];
      if (!box) continue;
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const widthAlongX = size.x >= size.z;
      const cutW = (widthAlongX ? size.x : size.z) * widthScale;
      const cutH = size.y * heightScale;
      const wallT = Math.max(widthAlongX ? size.z : size.x, 0.12);
      const cutD = wallT + 0.28;
      const geometry = new THREE.BoxGeometry(
        widthAlongX ? cutW : cutD,
        cutH,
        widthAlongX ? cutD : cutW,
      );
      const mesh = new THREE.Mesh(geometry, fill);
      mesh.position.set(center.x, box.min.y + cutH / 2, center.z);
      mesh.userData.findingId = finding.id;
      mesh.userData.guids = finding.highlightGlobalIds;
      mesh.frustumCulled = false;
      mesh.renderOrder = 2;
      group.add(mesh);

      const outline = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), line);
      outline.position.copy(mesh.position);
      outline.userData.findingId = finding.id;
      outline.userData.guids = finding.highlightGlobalIds;
      outline.frustumCulled = false;
      outline.renderOrder = 3;
      group.add(outline);
    }
  }
}

async function moveRoomWalls(
  model: FragmentsModel,
  group: THREE.Group,
  material: THREE.MeshLambertMaterial,
  findings: Finding[],
) {
  for (const finding of findings) {
    const moveIds = (await model.getLocalIdsByGuids([ROOM_WALL_GUID])).filter(
      (id): id is number => id !== null,
    );
    if (moveIds.length === 0) continue;

    const spanIds = (await model.getLocalIdsByGuids([ROOM_SPAN_GUID])).filter(
      (id): id is number => id !== null,
    );
    await model.setVisible(moveIds, false);
    const [moveBox] = await model.getBoxes(moveIds);
    const [spanBox] = spanIds.length
      ? await model.getBoxes(spanIds)
      : [moveBox];
    if (!moveBox || !spanBox) continue;

    const geometries = await model.getItemsGeometry(moveIds, 0);
    const size = moveBox.getSize(new THREE.Vector3());
    const center = moveBox.getCenter(new THREE.Vector3());
    const sourcePivot = new THREE.Vector3(center.x, moveBox.min.y, center.z);
    const targetPivot = sourcePivot.clone();
    const alongX = size.x >= size.z;
    if (alongX) {
      const towardMax =
        Math.abs(spanBox.max.z - center.z) >= Math.abs(spanBox.min.z - center.z);
      targetPivot.z = towardMax ? spanBox.max.z - ROOM_GAP_M : spanBox.min.z + ROOM_GAP_M;
    } else {
      const towardMax =
        Math.abs(spanBox.max.x - center.x) >= Math.abs(spanBox.min.x - center.x);
      targetPivot.x = towardMax ? spanBox.max.x - ROOM_GAP_M : spanBox.min.x + ROOM_GAP_M;
    }

    addMeshes(
      group,
      geometries[0],
      material,
      finding.id,
      sourcePivot,
      new THREE.Vector3(1, 1, 1),
      size,
      new THREE.Vector3(targetPivot.x, moveBox.min.y + size.y / 2, targetPivot.z),
      targetPivot,
    );
  }
}

function addMeshes(
  group: THREE.Group,
  meshDataList: { positions?: ArrayLike<number>; indices?: ArrayLike<number>; transform?: THREE.Matrix4 }[] | undefined,
  material: THREE.Material,
  findingId: string,
  sourcePivot: THREE.Vector3,
  scale: THREE.Vector3,
  fallbackSize: THREE.Vector3,
  fallbackCenter: THREE.Vector3,
  targetPivot = sourcePivot,
) {
  let added = 0;
  for (const meshData of meshDataList ?? []) {
    if (!meshData.positions) continue;
    const geometry = new THREE.BufferGeometry();
    const positions =
      meshData.positions instanceof Float32Array
        ? meshData.positions.slice()
        : new Float32Array(meshData.positions);
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    if (meshData.indices) {
      geometry.setIndex(new THREE.BufferAttribute(meshData.indices, 1));
    }
    if (meshData.transform) geometry.applyMatrix4(meshData.transform);
    geometry.translate(-sourcePivot.x, -sourcePivot.y, -sourcePivot.z);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(targetPivot);
    mesh.scale.copy(scale);
    mesh.userData.findingId = findingId;
    mesh.frustumCulled = false;
    group.add(mesh);
    added += 1;
  }

  if (added === 0) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(fallbackSize.x, fallbackSize.y, fallbackSize.z),
      material,
    );
    mesh.position.copy(fallbackCenter);
    mesh.userData.findingId = findingId;
    mesh.frustumCulled = false;
    group.add(mesh);
  }
}

export function pickOverlay(
  group: THREE.Object3D,
  raycaster: THREE.Raycaster,
) {
  group.updateMatrixWorld(true);
  const hits = raycaster.intersectObject(group, true);
  const hit =
    hits.find((item) => item.object instanceof THREE.Mesh && item.object.userData.findingId) ??
    hits.find((item) => item.object.userData.findingId);
  if (hit) {
    return {
      findingId: String(hit.object.userData.findingId),
      object: hit.object,
    };
  }

  const point = new THREE.Vector3();
  const box = new THREE.Box3();
  const closest: { findingId: string; object: THREE.Object3D; distance: number }[] = [];
  group.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || !child.userData.findingId) return;
    box.setFromObject(child);
    if (box.isEmpty() || !raycaster.ray.intersectBox(box, point)) return;
    closest.push({
      findingId: String(child.userData.findingId),
      object: child,
      distance: raycaster.ray.origin.distanceTo(point),
    });
  });
  closest.sort((a, b) => a.distance - b.distance);
  const nearest = closest[0];
  return nearest ? { findingId: nearest.findingId, object: nearest.object } : null;
}

export function overlayBoxForFinding(group: THREE.Object3D, findingId: string) {
  const box = new THREE.Box3();
  let found = false;
  group.updateMatrixWorld(true);
  group.traverse((child) => {
    if (child.userData.findingId === findingId && child instanceof THREE.Mesh) {
      box.expandByObject(child);
      found = true;
    }
  });
  return found ? box : null;
}

export async function houseBounds(model: FragmentsModel) {
  const localIds = (await model.getLocalIdsByGuids([FLOOR_GUID])).filter(
    (id): id is number => id !== null,
  );
  if (localIds.length > 0) {
    const boxes = await model.getBoxes(localIds);
    const union = new THREE.Box3();
    for (const box of boxes) union.union(box);
    if (!union.isEmpty()) return union;
  }
  return new THREE.Box3().setFromObject(model.object);
}

export async function frameBox(
  camera: { controls: CameraControlsLike },
  box: THREE.Box3,
  modelBox: THREE.Box3,
  options: { fromAbove?: boolean } = {},
) {
  if (box.isEmpty()) return;
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const padding = 2;

  if (options.fromAbove) {
    const distance = Math.max(size.x, size.z) * 1.7 + 8;
    await camera.controls.setLookAt(
      center.x,
      box.max.y + distance,
      center.z + 0.05,
      center.x,
      center.y,
      center.z,
      false,
    );
    return;
  }

  const distance = Math.max(size.x, size.y, size.z) * 2.3 + 7;
  const eye = center.clone();
  eye.y += Math.max(size.y * 0.55, 1.6);

  if (size.x >= size.z) {
    const toMax = modelBox.max.z - center.z;
    const toMin = center.z - modelBox.min.z;
    eye.z += (toMax <= toMin ? 1 : -1) * distance;
  } else {
    const toMax = modelBox.max.x - center.x;
    const toMin = center.x - modelBox.min.x;
    eye.x += (toMax <= toMin ? 1 : -1) * distance;
  }

  await camera.controls.setLookAt(
    eye.x,
    eye.y,
    eye.z,
    center.x,
    center.y,
    center.z,
    false,
  );
  await camera.controls.fitToBox(box, false, {
    paddingTop: padding,
    paddingLeft: padding,
    paddingRight: padding,
    paddingBottom: padding,
  });
}

type CameraControlsLike = {
  setLookAt: (
    positionX: number,
    positionY: number,
    positionZ: number,
    targetX: number,
    targetY: number,
    targetZ: number,
    enableTransition?: boolean,
  ) => Promise<unknown>;
  fitToBox: (
    box3OrObject: THREE.Box3 | THREE.Object3D,
    enableTransition: boolean,
    options?: {
      paddingLeft?: number;
      paddingRight?: number;
      paddingBottom?: number;
      paddingTop?: number;
    },
  ) => Promise<unknown>;
};

export async function frameOpenings(
  model: FragmentsModel,
  camera: { controls: CameraControlsLike },
  guids: string[],
  options: { fromAbove?: boolean } = {},
) {
  const localIds = (await model.getLocalIdsByGuids(guids)).filter(
    (id): id is number => id !== null,
  );
  if (localIds.length === 0) return;
  const boxes = await model.getBoxes(localIds);
  const union = new THREE.Box3();
  for (const box of boxes) union.union(box);
  if (options.fromAbove) union.expandByScalar(3);
  await frameBox(camera, union, await houseBounds(model), options);
}
