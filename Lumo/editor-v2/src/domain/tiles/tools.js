export const EDITOR_TOOLS = {
  INSPECT: "inspect",
  PAINT: "paint",
};

export const TOOL_OPTIONS = [
  { value: EDITOR_TOOLS.INSPECT, label: "Inspect" },
  { value: EDITOR_TOOLS.PAINT, label: "Paint" },
];

export function isEditorTool(value) {
  return TOOL_OPTIONS.some((option) => option.value === value);
}
