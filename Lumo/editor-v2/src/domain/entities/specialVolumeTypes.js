import { cloneEntityParams } from "./entityParams.js";

export const SPECIAL_VOLUME_EDITOR_LAYOUTS = Object.freeze({});
export const FOG_VOLUME_PARAM_SECTIONS = Object.freeze([]);

export function isSpecialVolumeEntityType() {
  return false;
}

export function getSpecialVolumeType() {
  return null;
}

export function getSpecialVolumeDescriptor() {
  return null;
}

export function listSpecialVolumeTypes() {
  return [];
}

export function isFogVolumeEntityType(type) {
  return String(type || "").trim().toLowerCase() === "fog_volume";
}

export function getFogVolumeParams(entity) {
  return cloneEntityParams(entity?.params);
}

export function getFogWorkbenchFieldMeta() {
  return null;
}

export function getFogVolumeRect() {
  return null;
}

export function getFogVolumeAnchorCell(entity) {
  return {
    x: Math.max(0, Math.round(Number(entity?.x) || 0)),
    y: Math.max(0, Math.round(Number(entity?.y) || 0)),
  };
}

export function createFogVolumeEntityFromWorldRect(entity) {
  return {
    ...entity,
    params: cloneEntityParams(entity?.params),
  };
}

export function getFogVolumeWorldRectFromDragCells() {
  return null;
}

export function shiftFogVolumeEntity(entity, deltaX = 0, deltaY = 0) {
  return {
    ...entity,
    x: (Number(entity?.x) || 0) + (Number(deltaX) || 0),
    y: (Number(entity?.y) || 0) + (Number(deltaY) || 0),
  };
}

export function syncFogVolumeEntityToAnchor(entity) {
  return {
    ...entity,
    params: cloneEntityParams(entity?.params),
  };
}

export function syncSpecialVolumeEntityToAnchor(entity) {
  return {
    ...entity,
    params: cloneEntityParams(entity?.params),
  };
}

export function applySpecialVolumeParamChange(entity, _path, _value) {
  return {
    ...entity,
    params: cloneEntityParams(entity?.params),
  };
}
