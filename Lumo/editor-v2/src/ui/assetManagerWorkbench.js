import {
  ASSET_MANAGER_CATEGORIES,
  getAssetManagerCategory,
  getDefaultAssetManagerCategoryId,
} from "../domain/assets/assetAuditCatalog.js";

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

export function getAssetManagerModalContent(state) {
  const config = state?.ui?.assetManager;
  if (!config?.isOpen) return null;

  const selectedCategoryId = config.selectedCategory || getDefaultAssetManagerCategoryId();
  const selectedCategory = getAssetManagerCategory(selectedCategoryId) || ASSET_MANAGER_CATEGORIES[0] || null;

  const totalRegistered = ASSET_MANAGER_CATEGORIES.reduce((sum, category) => sum + (Number(category?.count) || 0), 0);
  const runtimeCoupledCount = ASSET_MANAGER_CATEGORIES.filter((category) => Array.isArray(category.couplingNotes) && category.couplingNotes.length > 0).length;

  return {
    selectedCategoryId: selectedCategory?.id || selectedCategoryId,
    markup: `
      <section class="assetManagerModal panelSection" data-asset-manager-modal role="dialog" aria-modal="true" aria-label="Asset Manager">
        <header class="assetManagerHeader">
          <div>
            <h3>Asset Manager Foundation</h3>
            <p>Read-only audit and schema scaffold. Registration save/write is intentionally not implemented in this pass.</p>
          </div>
          <button type="button" class="topBarIconButton" data-asset-manager-action="close" aria-label="Close Asset Manager">×</button>
        </header>

        <div class="assetManagerMetaRow">
          <span class="badge">${ASSET_MANAGER_CATEGORIES.length} categories</span>
          <span class="badge">${totalRegistered} total registered presets/items</span>
          <span class="badge">${runtimeCoupledCount} runtime-coupled categories</span>
        </div>

        <div class="assetManagerBody">
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

          <section class="assetManagerContentPane">
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
        </div>
      </section>
    `,
  };
}
