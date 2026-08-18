/** Keep in sync with scripts/check-ifc.mjs */

export const MAX_EXTERIOR_DOOR_WIDTH_MM = 1200;
export const MAX_WINDOW_WIDTH_MM = 1500;
export const MIN_ROOM_AREA_M2 = 9.8;

export function evaluateExteriorDoorWidth(widthMm: number) {
  return {
    status: widthMm <= MAX_EXTERIOR_DOOR_WIDTH_MM ? "pass" : "fail",
    measured: widthMm,
    required: MAX_EXTERIOR_DOOR_WIDTH_MM,
  } as const;
}

export function evaluateWindowWidth(widthMm: number) {
  return {
    status: widthMm <= MAX_WINDOW_WIDTH_MM ? "pass" : "fail",
    measured: widthMm,
    required: MAX_WINDOW_WIDTH_MM,
  } as const;
}

export function evaluateRoomArea(areaM2: number) {
  return {
    status: areaM2 >= MIN_ROOM_AREA_M2 ? "pass" : "fail",
    measured: areaM2,
    required: MIN_ROOM_AREA_M2,
  } as const;
}
