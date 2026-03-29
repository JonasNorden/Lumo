function isHtmlInputElement(value) {
  return typeof HTMLInputElement !== "undefined" && value instanceof HTMLInputElement;
}

function isHtmlTextAreaElement(value) {
  return typeof HTMLTextAreaElement !== "undefined" && value instanceof HTMLTextAreaElement;
}

function isHtmlSelectElement(value) {
  return typeof HTMLSelectElement !== "undefined" && value instanceof HTMLSelectElement;
}

function isEditableInputType(input) {
  if (!isHtmlInputElement(input)) return false;
  const type = typeof input.type === "string" ? input.type.toLowerCase() : "text";
  return !["button", "checkbox", "radio", "range", "submit", "reset", "file", "image", "color"].includes(type);
}

export function isNativeTextEditingElement(value) {
  if (!value || !(value instanceof Element)) return false;
  if (isHtmlTextAreaElement(value) || isHtmlSelectElement(value)) return true;
  if (isEditableInputType(value)) return true;
  if (value instanceof HTMLElement) {
    return value.isContentEditable
      || value.getAttribute("contenteditable") === ""
      || value.getAttribute("contenteditable") === "true";
  }
  return false;
}

export function hasNativeTextEditingFocus(doc = document) {
  const activeElement = doc?.activeElement;
  if (!(activeElement instanceof Element)) return false;
  if (isNativeTextEditingElement(activeElement)) return true;
  const closestEditor = activeElement.closest("input, textarea, select, [contenteditable='true'], [contenteditable='']");
  return isNativeTextEditingElement(closestEditor);
}

export function isNativeTextEditingEventTarget(eventTarget) {
  if (!(eventTarget instanceof Element)) return false;
  if (isNativeTextEditingElement(eventTarget)) return true;
  const closestEditor = eventTarget.closest("input, textarea, select, [contenteditable='true'], [contenteditable='']");
  return isNativeTextEditingElement(closestEditor);
}

export function stopNativeInputKeyboardPropagation(event) {
  if (!isNativeTextEditingEventTarget(event.target)) return;
  event.stopPropagation();
}
