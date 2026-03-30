import {
  ASSET_MANAGER_CATEGORIES,
  getAssetManagerCategory,
  getDefaultAssetManagerCategoryId,
} from "../domain/assets/assetAuditCatalog.js";
import {
  ASSET_WIZARD_MODES,
  ASSET_WIZARD_TYPE_OPTIONS,
  createInitialAssetManagerWizardState,
  getAssetWizardDraftWithDefaults,
  getExistingAssetOptions,
  getFirstIncompleteStep,
  getCanonicalTileIdForBehavior,
  getTileBehaviorById,
  getTileBehaviorOptions,
  getStepValidation,
  getStepsForWizard,
  isStepComplete,
} from "../domain/assets/assetManagerWizardModel.js";

export { createInitialAssetManagerWizardState, getAssetWizardDraftWithDefaults, getFirstIncompleteStep, getStepsForWizard, isStepComplete };

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderList(items = [], emptyLabel = "None") {
  if (!Array.isArray(items) || items.length === 0) {
    return `<li class="assetManagerListItem isMuted">${escapeHtml(emptyLabel)}</li>`;
  }

  return items
    .map((item) => `<li class="assetManagerListItem">${escapeHtml(item)}</li>`)
    .join("");
}

function renderSchemaFields(fields = []) {
  if (!Array.isArray(fields) || fields.length === 0) {
    return '<div class="assetManagerMuted">No schema fields mapped yet.</div>';
  }

  return `
    <div class="assetManagerFieldTable" role="table" aria-label="Registration fields">
      <div class="assetManagerFieldRow isHead" role="row">
        <span role="columnheader">Field</span>
        <span role="columnheader">Type</span>
        <span role="columnheader">Required</span>
      </div>
      ${fields.map((field) => `
        <div class="assetManagerFieldRow" role="row">
          <span role="cell">${escapeHtml(field.label || field.key || "Field")}</span>
          <span role="cell">${escapeHtml(field.type || "-")}</span>
          <span role="cell">${field.required ? "Yes" : "Optional"}</span>
        </div>
      `).join("")}
    </div>
  `;
}

function getStepTitle(stepId) {
  if (stepId === "mode") return "Mode";
  if (stepId === "type") return "Asset Type";
  if (stepId === "identity") return "Asset Source & Identity";
  if (stepId === "metadata") return "Metadata";
  if (stepId === "review") return "Review";
  if (stepId === "save") return "Save / Register";
  return "Step";
}

function renderInfoTip(text = "") {
  if (!text) return "";
  return `<span class="assetWizardInfoTip" role="img" aria-label="${escapeHtml(text)}" title="${escapeHtml(text)}">i</span>`;
}

function renderInput(label, field, value, placeholder, description = "", options = {}) {
  const errorMessage = options.errorMessage || "";
  const infoTip = options.infoTip || "";
  const statusMessage = options.statusMessage || "";
  const statusClass = options.statusClass || "";
  const fieldClass = options.fieldClass || "";
  return `
    <label class="assetWizardField ${escapeHtml(fieldClass)}" for="asset-wizard-${escapeHtml(field)}">
      <span class="assetWizardFieldLabelRow">
        <span class="assetWizardFieldLabel">${escapeHtml(label)}</span>
        ${renderInfoTip(infoTip)}
      </span>
      ${description ? `<span class="assetWizardFieldHelp">${escapeHtml(description)}</span>` : ""}
      <input
        id="asset-wizard-${escapeHtml(field)}"
        data-asset-manager-field="${escapeHtml(field)}"
        data-asset-manager-draft-field="${escapeHtml(field)}"
        aria-invalid="${errorMessage ? "true" : "false"}"
        type="text"
        class="${errorMessage ? "isInvalid" : ""}"
        value="${escapeHtml(value || "")}"
        placeholder="${escapeHtml(placeholder || "")}"
        autocomplete="off"
      />
      ${errorMessage ? `<span class="assetWizardFieldError">${escapeHtml(errorMessage)}</span>` : ""}
      ${statusMessage ? `<span class="assetWizardFieldHelp ${escapeHtml(statusClass)}">${escapeHtml(statusMessage)}</span>` : ""}
    </label>
  `;
}

function renderFilePickerField(label, field, wizard, options = {}) {
  const value = wizard?.draft?.[field] || "";
  const fileName = wizard?.draft?.spriteFileName || "";
  const errorMessage = options.errorMessage || "";
  const hint = options.hint || "";
  const fieldClass = options.fieldClass || "";
  return `
    <div class="assetWizardField ${escapeHtml(fieldClass)}">
      <span class="assetWizardFieldLabelRow">
        <span class="assetWizardFieldLabel">${escapeHtml(label)}</span>
        ${renderInfoTip(options.infoTip || "")}
      </span>
      ${hint ? `<span class="assetWizardFieldHelp">${escapeHtml(hint)}</span>` : ""}
      <div class="assetWizardFilePickerRow">
        <button type="button" class="assetWizardNavButton" data-asset-manager-action="choose-file" data-asset-manager-file-field="${escapeHtml(field)}">Choose File</button>
        <span class="assetWizardFileName${fileName ? "" : " isMuted"}">${escapeHtml(fileName || "No file selected")}</span>
      </div>
      <input
        type="file"
        class="assetWizardHiddenFileInput"
        data-asset-manager-file-field="${escapeHtml(field)}"
        accept="image/*"
      />
      <input
        type="text"
        readonly
        data-asset-manager-field="${escapeHtml(field)}"
        class="${errorMessage ? "isInvalid" : ""}"
        value="${escapeHtml(value)}"
        placeholder="Selected file path placeholder"
      />
      ${errorMessage ? `<span class="assetWizardFieldError">${escapeHtml(errorMessage)}</span>` : ""}
    </div>
  `;
}

function renderSelectInput(label, field, value, optionsList = [], description = "", options = {}) {
  const errorMessage = options.errorMessage || "";
  const infoTip = options.infoTip || "";
  const placeholder = options.placeholder || "Select…";
  const fieldClass = options.fieldClass || "";
  return `
    <label class="assetWizardField ${escapeHtml(fieldClass)}" for="asset-wizard-${escapeHtml(field)}">
      <span class="assetWizardFieldLabelRow">
        <span class="assetWizardFieldLabel">${escapeHtml(label)}</span>
        ${renderInfoTip(infoTip)}
      </span>
      ${description ? `<span class="assetWizardFieldHelp">${escapeHtml(description)}</span>` : ""}
      <select
        id="asset-wizard-${escapeHtml(field)}"
        data-asset-manager-field="${escapeHtml(field)}"
        data-asset-manager-draft-field="${escapeHtml(field)}"
        aria-invalid="${errorMessage ? "true" : "false"}"
        class="${errorMessage ? "isInvalid" : ""}"
      >
        <option value="">${escapeHtml(placeholder)}</option>
        ${optionsList.map((option) => `
          <option value="${escapeHtml(option.value)}" ${String(option.value) === String(value || "") ? "selected" : ""}>
            ${escapeHtml(option.label)}
          </option>
        `).join("")}
      </select>
      ${errorMessage ? `<span class="assetWizardFieldError">${escapeHtml(errorMessage)}</span>` : ""}
    </label>
  `;
}

function renderStepBody(wizard, validation) {
  const mode = wizard.mode;
  const type = wizard.assetType;
  const draft = getAssetWizardDraftWithDefaults(type, wizard.draft || {});
  const fieldErrors = validation?.fieldErrors || {};

  if (wizard.stepId === "mode") {
    const isCreate = mode === ASSET_WIZARD_MODES.CREATE;
    const isEdit = mode === ASSET_WIZARD_MODES.EDIT;
    return `
      <div class="assetWizardSection">
        <h4>Choose workflow mode</h4>
        <p>Start by choosing whether you are registering a new asset shell or guiding an update for an existing one.</p>
        <div class="assetWizardChoiceGrid">
          <button type="button" class="assetWizardChoiceButton${isCreate ? " isActive" : ""}" data-asset-manager-action="set-mode" data-asset-manager-mode="create" aria-pressed="${isCreate ? "true" : "false"}">
            <strong>Create New Asset</strong>
            <span>Guided shell for new metadata registration.</span>
          </button>
          <button type="button" class="assetWizardChoiceButton${isEdit ? " isActive" : ""}" data-asset-manager-action="set-mode" data-asset-manager-mode="edit" aria-pressed="${isEdit ? "true" : "false"}">
            <strong>Edit Existing Asset</strong>
            <span>Pick an existing asset id and open a guided edit shell.</span>
          </button>
        </div>
      </div>
    `;
  }

  if (wizard.stepId === "type") {
    return `
      <div class="assetWizardSection">
        <h4>Choose asset type</h4>
        <p>Only fields relevant to the selected type will be shown in the next steps.</p>
        <div class="assetWizardTypeGrid">
          ${ASSET_WIZARD_TYPE_OPTIONS.map((option) => {
            const isActive = option.id === type;
            return `
              <button type="button" class="assetWizardTypeButton${isActive ? " isActive" : ""}" data-asset-manager-action="set-type" data-asset-manager-type="${escapeHtml(option.id)}" aria-pressed="${isActive ? "true" : "false"}">
                ${escapeHtml(option.label)}
              </button>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }

  if (wizard.stepId === "identity") {
    if (mode === ASSET_WIZARD_MODES.EDIT) {
      const options = getExistingAssetOptions(type);
      return `
        <div class="assetWizardSection">
          <h4>Select existing ${escapeHtml(type || "asset")} entry</h4>
          <p>Choose a registered item as your edit target. Final save/write behavior is still deferred.</p>
          <label class="assetWizardField" for="asset-wizard-existing-id">
            <span class="assetWizardFieldLabel">Registered asset</span>
            <select id="asset-wizard-existing-id" data-asset-manager-select="existing-id" data-asset-manager-field="selected-existing">
              <option value="">Choose an asset…</option>
              ${options.map((option) => `<option value="${escapeHtml(option.id)}" ${option.id === wizard.selectedExistingAssetId ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
            </select>
            ${fieldErrors.selectedExistingAssetId ? `<span class="assetWizardFieldError">${escapeHtml(fieldErrors.selectedExistingAssetId)}</span>` : ""}
          </label>
        </div>
      `;
    }

    if (type === "tiles") {
      const tileBehaviorOptions = getTileBehaviorOptions();
      const catalogIdAvailability = draft.catalogIdAvailability || "";
      const catalogIdStatus = catalogIdAvailability === "taken"
        ? "Already exists"
        : catalogIdAvailability === "available"
          ? "Available"
          : "";
      return `
        <div class="assetWizardSection">
          <h4>Tile identity</h4>
          <p>Choose gameplay behavior first; the wizard maps it to a safe runtime tile id automatically.</p>
          <div class="assetWizardFieldGrid">
            ${renderInput("Catalog id", "catalogId", draft.catalogId, "stone-floor", "Unique technical registry key.", { errorMessage: fieldErrors.catalogId, statusMessage: catalogIdStatus, statusClass: catalogIdAvailability === "taken" ? "assetWizardFieldError" : "assetManagerMuted" })}
            ${renderInput("Display name", "displayName", draft.displayName, "Stone Floor", "", { errorMessage: fieldErrors.displayName })}
            ${renderSelectInput("Tile behavior", "tileBehavior", draft.tileBehavior, tileBehaviorOptions, "Gameplay semantics (Solid, Ice, One-way, Hazard, Brake).", { errorMessage: fieldErrors.tileBehavior, infoTip: "Maps to canonical runtime tile ids: Solid→15, Ice→4, One-way→2, Hazard→3, Brake→5." })}
            <label class="assetWizardField" for="asset-wizard-tileNumericId"><span class="assetWizardFieldLabelRow"><span class="assetWizardFieldLabel">Mapped runtime tile id</span></span><span class="assetWizardFieldHelp">Auto-mapped from behavior. Shown for transparency and review.</span><input id="asset-wizard-tileNumericId" type="text" readonly value="${escapeHtml(String(getCanonicalTileIdForBehavior(draft.tileBehavior) || draft.tileNumericId || ""))}" /><span class="assetWizardFieldHelp">Advanced detail only. Primary choice is behavior.</span>${fieldErrors.tileNumericId ? `<span class="assetWizardFieldError">${escapeHtml(fieldErrors.tileNumericId)}</span>` : ""}</label>
            ${renderFilePickerField("Sprite file", "spritePath", wizard, { errorMessage: fieldErrors.spritePath, hint: "Recommended folder: data/assets/tiles/", infoTip: "Optional for now in architecture, but required to proceed in this wizard." })}
          </div>
        </div>
      `;
    }

    if (type === "background") {
      const materialIdAvailability = draft.materialIdAvailability || "";
      const materialIdStatus = materialIdAvailability === "taken"
        ? "Already exists"
        : materialIdAvailability === "available"
          ? "Available"
          : "";
      return `
        <div class="assetWizardSection">
          <h4>Background identity</h4>
          <p>Define a unique technical id and sprite source. The wizard auto-suggests the next available material id as you type.</p>
          <div class="assetWizardFieldGrid">
            ${renderInput("Display name", "displayName", draft.displayName, "Stone Background", "Human-friendly picker label.", { errorMessage: fieldErrors.displayName, fieldClass: "assetWizardFieldSpan6" })}
            ${renderInput("Material id", "materialId", draft.materialId, "bg_stone_background", "Unique technical id used for persistence and reload.", { errorMessage: fieldErrors.materialId, statusMessage: materialIdStatus, statusClass: materialIdAvailability === "taken" ? "assetWizardFieldError" : "assetManagerMuted", infoTip: "Auto-suggested from display name or file name. You can override manually.", fieldClass: "assetWizardFieldSpan6" })}
            ${renderFilePickerField("Sprite file", "spritePath", wizard, { errorMessage: fieldErrors.spritePath, hint: "Recommended folder: data/assets/sprites/bg/", infoTip: "Choose the texture image for this background material.", fieldClass: "assetWizardFieldSpan12" })}
          </div>
        </div>
      `;
    }

    return `
      <div class="assetWizardSection">
        <h4>${type === "decor" ? "Decor" : "Entity"} flow scaffolding</h4>
        <p>This wizard path is scaffolded in this pass. Metadata editing will be expanded in the next milestone.</p>
      </div>
    `;
  }

  if (wizard.stepId === "metadata") {
    if (type === "tiles") {
      return `
        <div class="assetWizardSection">
          <h4>Tile metadata</h4>
          <p>Set behavior and draw/footprint related metadata used by editor and runtime mappings.</p>
          <div class="assetWizardFieldGrid">
            <label class="assetWizardField" for="asset-wizard-collisionType"><span class="assetWizardFieldLabelRow"><span class="assetWizardFieldLabel">Collision profile (from behavior)</span>${renderInfoTip("Derived from Tile behavior to keep save semantics safe.")}</span><input id="asset-wizard-collisionType" type="text" readonly value="${escapeHtml(draft.collisionType || "")}" />${fieldErrors.collisionType ? `<span class="assetWizardFieldError">${escapeHtml(fieldErrors.collisionType)}</span>` : ""}</label>
            ${renderInput("Draw anchor", "drawAnchor", draft.drawAnchor, "BL", "", { errorMessage: fieldErrors.drawAnchor, infoTip: "Defines how the sprite aligns to the grid (BL = bottom-left)." })}
            ${renderInput("Draw width px", "drawWidth", draft.drawWidth, "24", "", { errorMessage: fieldErrors.drawWidth })}
            ${renderInput("Draw height px", "drawHeight", draft.drawHeight, "24", "", { errorMessage: fieldErrors.drawHeight })}
            ${renderInput("Footprint (JSON)", "footprint", draft.footprint, '{"w":1,"h":1}', "", { errorMessage: fieldErrors.footprint })}
          </div>
        </div>
      `;
    }
    if (type === "background") {
      return `
        <div class="assetWizardSection">
          <h4>Background metadata</h4>
          <p>Background materials are visual only. Anchor defaults to BL and gameplay behavior is intentionally omitted.</p>
          <div class="assetWizardFieldGrid">
            ${renderInput("Draw anchor", "drawAnchor", draft.drawAnchor || "BL", "BL", "", { errorMessage: fieldErrors.drawAnchor, infoTip: "Defines how the sprite aligns to the grid (BL = bottom-left).", fieldClass: "assetWizardFieldSpan4" })}
            ${renderInput("Draw width px", "drawWidth", draft.drawWidth, "24", "", { errorMessage: fieldErrors.drawWidth, fieldClass: "assetWizardFieldSpan4" })}
            ${renderInput("Draw height px", "drawHeight", draft.drawHeight, "24", "", { errorMessage: fieldErrors.drawHeight, fieldClass: "assetWizardFieldSpan4" })}
            ${renderInput("Fallback color", "fallbackColor", draft.fallbackColor, "#3d4b63", "", { errorMessage: fieldErrors.fallbackColor, fieldClass: "assetWizardFieldSpan6" })}
            ${renderInput("Footprint (JSON)", "footprint", draft.footprint, '{"w":1,"h":1}', "", { fieldClass: "assetWizardFieldSpan6" })}
          </div>
        </div>
      `;
    }
    return `
      <div class="assetWizardSection">
        <h4>Metadata scaffolding</h4>
        <p>${type === "decor" ? "Decor" : "Entity"} metadata steps are not fully implemented in this pass.</p>
      </div>
    `;
  }

  if (wizard.stepId === "review") {
    const tileBehavior = getTileBehaviorById(draft.tileBehavior);
    const rows = [
      ["Mode", mode || "—"],
      ["Asset type", type || "—"],
      ["Existing target", wizard.selectedExistingAssetId || "(new asset)"],
      ...(type === "tiles" ? [["Tile behavior", tileBehavior ? `${tileBehavior.label}` : "—"], ["Mapped runtime tile id", String(draft.tileNumericId || "")]] : []),
      ...(Object.entries(draft || {})
        .filter(([key]) => !(type === "tiles" && (key === "tileBehavior" || key === "tileNumericId")))
        .map(([key, value]) => [key, String(value ?? "")])
        .filter(([, value]) => value.trim().length > 0)),
    ];

    return `
      <div class="assetWizardSection">
        <h4>Review</h4>
        <p>Check your draft before the final register/save step.</p>
        <div class="assetWizardReviewTable" role="table" aria-label="Draft summary">
          ${rows.map(([key, value]) => `<div class="assetWizardReviewRow" role="row"><span role="cell">${escapeHtml(key)}</span><span role="cell">${escapeHtml(value)}</span></div>`).join("")}
        </div>
      </div>
    `;
  }

  return `
    <div class="assetWizardSection">
      <h4>Save / Register</h4>
      <p class="assetManagerMuted">${wizard.assetType === "background"
        ? "Register this background material into editor-v2 and runtime background catalogs for immediate use in the Background workflow."
        : "Register this tile into the live editor-v2 tile catalog for immediate use in the Tiles workflow."}</p>
      ${wizard?.draft?.saveFeedback ? `<p class="assetWizardStepNotice" role="status">${escapeHtml(wizard.draft.saveFeedback)}</p>` : ""}
    </div>
  `;
}

function renderPreviewPane(wizard) {
  const draft = wizard?.draft || {};
  const previewSource = draft.spritePreviewUrl || draft.spritePath || "";
  if (!previewSource) {
    return `
      <aside class="assetWizardPreviewPane" aria-label="Sprite preview">
        <h5>Sprite Preview</h5>
        <p class="assetWizardPreviewHelp">Preview is intentionally secondary so the form remains the dominant workspace.</p>
        <div class="assetWizardPreviewPlaceholder">No preview available yet</div>
      </aside>
    `;
  }
  return `
    <aside class="assetWizardPreviewPane" aria-label="Sprite preview">
      <h5>Sprite Preview</h5>
      <p class="assetWizardPreviewHelp">Current sprite draft rendered from selected source.</p>
      <div class="assetWizardPreviewCanvas">
        <img src="${escapeHtml(previewSource)}" alt="Selected sprite preview" />
      </div>
    </aside>
  `;
}

function renderWizardPane(wizard) {
  const steps = getStepsForWizard();
  const currentIndex = Math.max(0, steps.indexOf(wizard.stepId));
  const canMoveBack = currentIndex > 0;
  const stepValidation = getStepValidation(wizard.stepId, wizard);
  const isFinalStep = currentIndex === (steps.length - 1);
  const canMoveNext = isFinalStep ? true : currentIndex < (steps.length - 1) && stepValidation.isValid;
  const nextLabel = isFinalStep
    ? wizard.assetType === "tiles"
      ? "Save Tile"
      : wizard.assetType === "background"
        ? "Save Background"
        : "Done"
    : "Next";

  return `
    <section class="assetWizardWorkbench" aria-label="Asset wizard">
      <div class="assetWizardWorkbenchShell">
        <div class="assetWizardMainPane">
          <div class="assetWizardHeader">
            <h4>Guided Asset Wizard</h4>
            <p>Wizard-first registration shell for LumoEditor V2 asset manager.</p>
          </div>

          <ol class="assetWizardSteps" aria-label="Wizard progression">
            ${steps.map((stepId, index) => {
              const isActive = index === currentIndex;
              const isDone = index < currentIndex && isStepComplete(stepId, wizard);
              return `<li class="assetWizardStep${isActive ? " isActive" : ""}${isDone ? " isDone" : ""}"><span>${index + 1}. ${escapeHtml(getStepTitle(stepId))}</span></li>`;
            }).join("")}
          </ol>

          <div class="assetWizardMainBody">
            ${renderStepBody(wizard, stepValidation)}
          </div>
          ${!stepValidation.isValid && stepValidation.blockingReason ? `<p class="assetWizardStepNotice" role="alert">${escapeHtml(stepValidation.blockingReason)}</p>` : ""}

          <footer class="assetWizardFooter">
            <button type="button" class="assetWizardNavButton" data-asset-manager-action="wizard-cancel">Cancel</button>
            <div class="assetWizardFooterRight">
              <button type="button" class="assetWizardNavButton" data-asset-manager-action="wizard-back" ${canMoveBack ? "" : "disabled"}>Back</button>
              <button type="button" class="assetWizardNavButton isPrimary" data-asset-manager-action="wizard-next" ${canMoveNext ? "" : "disabled"}>${nextLabel}</button>
            </div>
          </footer>
        </div>
        <div class="assetWizardAsidePane">
          ${renderPreviewPane(wizard)}
        </div>
      </div>
    </section>
  `;
}

function renderOverviewPane(selectedCategory) {
  return `
    <section class="assetManagerContentPane" aria-label="Asset manager overview">
      ${selectedCategory ? `
        <div class="assetManagerSection">
          <h4>${escapeHtml(selectedCategory.label)}</h4>
          <p>${escapeHtml(selectedCategory.schema?.summary || "No summary available.")}</p>
        </div>

        <div class="assetManagerGrid">
          <article class="assetManagerCard">
            <h5>Current sources of truth</h5>
            <ul class="assetManagerList">${renderList(selectedCategory.registries, "No registry mapping yet.")}</ul>
          </article>

          <article class="assetManagerCard">
            <h5>Existing source folders</h5>
            <ul class="assetManagerList">${renderList(selectedCategory.sourceFolders, "No source folders mapped yet.")}</ul>
          </article>
        </div>

        <div class="assetManagerGrid">
          <article class="assetManagerCard">
            <h5>Observed metadata dependencies</h5>
            <ul class="assetManagerList">${renderList(selectedCategory.metadataReality, "No metadata audit notes yet.")}</ul>
          </article>

          <article class="assetManagerCard">
            <h5>Runtime coupling notes</h5>
            <ul class="assetManagerList">${renderList(selectedCategory.couplingNotes, "No runtime coupling noted.")}</ul>
          </article>
        </div>

        <article class="assetManagerCard">
          <h5>Future registration schema</h5>
          ${renderSchemaFields(selectedCategory.schema?.requiredFields || [])}
        </article>

        <div class="assetManagerGrid">
          <article class="assetManagerCard">
            <h5>Sample registered items</h5>
            <ul class="assetManagerList">${renderList(selectedCategory.samples, "No samples available.")}</ul>
          </article>

          <article class="assetManagerCard">
            <h5>Editor-only notes</h5>
            <ul class="assetManagerList">${renderList(selectedCategory.editorOnlyNotes, "No editor-only notes.")}</ul>
          </article>
        </div>
      ` : `
        <div class="assetManagerCard">
          <h5>No category selected</h5>
        </div>
      `}
    </section>
  `;
}

export function getAssetManagerModalContent(state) {
  const config = state?.ui?.assetManager;
  if (!config?.isOpen) return null;

  const activeView = config.activeView === "overview" ? "overview" : "wizard";
  const selectedCategoryId = config.selectedCategory || getDefaultAssetManagerCategoryId();
  const selectedCategory = getAssetManagerCategory(selectedCategoryId) || ASSET_MANAGER_CATEGORIES[0] || null;
  const wizard = config.wizard || createInitialAssetManagerWizardState();

  const totalRegistered = ASSET_MANAGER_CATEGORIES.reduce((sum, category) => sum + (Number(category?.count) || 0), 0);

  return {
    selectedCategoryId: selectedCategory?.id || selectedCategoryId,
    markup: `
      <section class="assetManagerModal panelSection" data-asset-manager-modal role="dialog" aria-modal="true" aria-label="Asset Manager">
        <header class="assetManagerHeader">
          <div>
            <h3>Asset Manager</h3>
            <p>Wizard-first registration shell. Audit/registry details remain available in Overview.</p>
          </div>
          <button type="button" class="topBarIconButton" data-asset-manager-action="close" aria-label="Close Asset Manager">×</button>
        </header>

        <div class="assetManagerMetaRow">
          <span class="badge">${ASSET_MANAGER_CATEGORIES.length} categories</span>
          <span class="badge">${totalRegistered} registered presets/items</span>
          <span class="badge">M24B wizard foundation</span>
        </div>

        <div class="assetManagerViewToggle" role="tablist" aria-label="Asset manager view mode">
          <button type="button" class="assetManagerTabButton${activeView === "wizard" ? " isActive" : ""}" data-asset-manager-action="set-view" data-asset-manager-view="wizard" role="tab" aria-selected="${activeView === "wizard" ? "true" : "false"}">Guided Wizard</button>
          <button type="button" class="assetManagerTabButton${activeView === "overview" ? " isActive" : ""}" data-asset-manager-action="set-view" data-asset-manager-view="overview" role="tab" aria-selected="${activeView === "overview" ? "true" : "false"}">Overview / Audit</button>
        </div>

        <div class="assetManagerBody${activeView === "wizard" ? " isWizardView" : ""}">
          ${activeView === "overview" ? `
            <aside class="assetManagerCategoryRail" aria-label="Asset categories">
              ${ASSET_MANAGER_CATEGORIES.map((category) => {
                const isActive = category.id === selectedCategory?.id;
                return `
                  <button
                    type="button"
                    class="assetManagerCategoryButton${isActive ? " isActive" : ""}"
                    data-asset-manager-category="${escapeHtml(category.id)}"
                    aria-pressed="${isActive ? "true" : "false"}"
                  >
                    <span>${escapeHtml(category.label)}</span>
                    <span class="assetManagerCategoryCount">${Number(category.count) || 0}</span>
                  </button>
                `;
              }).join("")}
            </aside>
          ` : ""}

          ${activeView === "wizard" ? renderWizardPane(wizard) : renderOverviewPane(selectedCategory)}
        </div>
      </section>
    `,
  };
}
