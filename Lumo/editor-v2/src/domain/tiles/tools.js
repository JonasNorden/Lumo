export const EDITOR_TOOLS = {
  INSPECT: "inspect",
  PAINT: "paint",
  ERASE: "erase",
};

export const TOOL_OPTIONS = [
  { value: EDITOR_TOOLS.INSPECT, label: "Inspect" },
  { value: EDITOR_TOOLS.PAINT, label: "Paint" },
  { value: EDITOR_TOOLS.ERASE, label: "Erase" },
];

export function isEditorTool(value) {
  return TOOL_OPTIONS.some((option) => option.value === value);
}
