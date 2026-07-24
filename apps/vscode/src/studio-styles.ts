export const studioStyles = String.raw`
:root {
  color-scheme: light dark;
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
  color: var(--vscode-foreground);
  background: var(--vscode-editor-background);
}

* {
  box-sizing: border-box;
}

html,
body {
  min-width: 0;
  min-height: 100%;
  margin: 0;
  padding: 0;
  background: var(--vscode-editor-background);
  color: var(--vscode-foreground);
}

button,
input,
select,
textarea {
  min-width: 0;
  font: inherit;
  font-size: max(12px, var(--vscode-font-size));
}

button,
select,
input,
textarea {
  border: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
  border-radius: 3px;
}

button:focus-visible,
select:focus-visible,
input:focus-visible,
textarea:focus-visible,
a:focus-visible,
[tabindex]:focus-visible {
  outline: 1px solid var(--vscode-focusBorder);
  outline-offset: 1px;
}

button {
  min-height: 28px;
  padding: 4px 10px;
  color: var(--vscode-button-foreground);
  background: var(--vscode-button-background);
  cursor: pointer;
}

button:hover:not(:disabled) {
  background: var(--vscode-button-hoverBackground);
}

button.secondary {
  color: var(--vscode-button-secondaryForeground);
  background: var(--vscode-button-secondaryBackground);
}

button.secondary:hover:not(:disabled) {
  background: var(--vscode-button-secondaryHoverBackground);
}

button.danger {
  color: var(--vscode-errorForeground);
  background: var(--vscode-editor-background);
  border-color: var(--vscode-inputValidation-errorBorder);
}

button:disabled {
  cursor: default;
  opacity: 0.65;
}

input,
select,
textarea {
  min-height: 32px;
  padding: 5px 8px;
  color: var(--vscode-input-foreground);
  background: var(--vscode-input-background);
  border-color: var(--vscode-input-border, var(--vscode-widget-border));
}

textarea {
  min-height: 96px;
  resize: vertical;
  line-height: 1.45;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* Product Studio remains legible when the host has no packaged Codicon font. */
.codicon {
  display: inline-grid;
  place-items: center;
  min-width: 1em;
  font-family: var(--vscode-font-family);
  font-style: normal;
}

.codicon-circle-outline::before { content: "○"; }
.codicon-sync::before { content: "↻"; }
.codicon-pass::before { content: "✓"; }
.codicon-error::before { content: "×"; }
.codicon-warning::before { content: "!"; }
.codicon-copy::before { content: "⧉"; }

.studio-shell {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 208px minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr) auto;
}

.studio-rail {
  grid-row: 1 / 3;
  min-width: 0;
  padding: 16px 8px;
  border-right: 1px solid var(--vscode-panel-border);
  background: var(--vscode-sideBar-background);
  color: var(--vscode-sideBar-foreground);
}

.studio-name {
  margin: 0 8px 16px;
  font-size: 15px;
  line-height: 1.4;
  font-weight: 600;
}

.studio-nav {
  display: grid;
  gap: 2px;
}

.studio-nav button {
  width: 100%;
  min-height: 32px;
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr);
  gap: 8px;
  align-items: start;
  padding: 6px 8px;
  text-align: left;
  color: var(--vscode-sideBar-foreground);
  background: transparent;
  border-color: transparent;
}

.studio-nav button:hover:not(:disabled) {
  background: var(--vscode-list-hoverBackground);
}

.studio-nav button[aria-current="page"] {
  color: var(--vscode-list-activeSelectionForeground);
  background: var(--vscode-list-activeSelectionBackground);
  border-color: var(--vscode-focusBorder);
}

.nav-copy {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.nav-label,
.nav-state {
  overflow-wrap: anywhere;
}

.nav-state {
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
  line-height: 1.3;
}

button[aria-current="page"] .nav-state {
  color: currentColor;
}

.studio-mobile-nav {
  display: none;
  padding: 12px 16px 0;
}

.studio-mobile-nav label {
  display: block;
  margin-bottom: 4px;
  font-weight: 600;
}

.studio-mobile-nav select {
  width: 100%;
}

.studio-workspace {
  min-width: 0;
  width: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1040px);
  justify-content: center;
  gap: 24px;
  padding: 24px;
}

.studio-workspace.with-inspector {
  grid-template-columns: minmax(0, 1040px) 280px;
  max-width: 1368px;
  margin: 0 auto;
}

.studio-main,
.studio-inspector {
  min-width: 0;
}

.page-header {
  margin-bottom: 24px;
}

.page-header h2 {
  margin: 0 0 8px;
  font-size: 20px;
  line-height: 1.3;
  font-weight: 600;
}

.page-purpose,
.prose {
  max-width: 72ch;
  line-height: 1.5;
}

.page-purpose,
.source-line,
.muted,
.field-question,
.field-provenance,
.validation-message {
  color: var(--vscode-descriptionForeground);
}

.source-line {
  margin-top: 8px;
  font-size: 12px;
  overflow-wrap: anywhere;
}

.section {
  margin: 0 0 24px;
}

.section > h3,
.studio-inspector h2,
.studio-inspector h3 {
  margin: 0 0 12px;
  font-size: 15px;
  line-height: 1.4;
  font-weight: 600;
}

.grouped-section {
  padding: 16px;
  border: 1px solid var(--vscode-panel-border);
  border-radius: 5px;
}

.action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.primary-action {
  margin: 16px 0 24px;
}

.progress-list,
.issue-list,
.limitation-list,
.event-list,
.plain-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.progress-row,
.issue-row,
.event-row,
.plain-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--vscode-panel-border);
}

.progress-row:first-child,
.issue-row:first-child,
.event-row:first-child,
.plain-row:first-child {
  border-top: 1px solid var(--vscode-panel-border);
}

.issue-row.error,
.issue-row.blocker {
  border-left: 3px solid var(--vscode-inputValidation-errorBorder);
  padding-left: 8px;
}

.issue-row.warning {
  border-left: 3px solid var(--vscode-inputValidation-warningBorder);
  padding-left: 8px;
}

.definition-columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px;
}

dl {
  margin: 0;
}

dt {
  margin-top: 8px;
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
}

dd {
  margin: 2px 0 8px;
  overflow-wrap: anywhere;
}

.field-list {
  display: grid;
  gap: 16px;
}

.record-field {
  display: grid;
  grid-template-columns: minmax(140px, 220px) minmax(0, 1fr);
  gap: 8px 16px;
  align-items: start;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--vscode-panel-border);
}

.record-field > label,
.field-label {
  font-weight: 600;
  line-height: 1.4;
}

.field-control {
  min-width: 0;
  display: grid;
  gap: 6px;
}

.field-control input,
.field-control textarea,
.field-control select {
  width: 100%;
}

.field-question,
.field-provenance,
.validation-message {
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
}

.validation-message.invalid,
.validation-message.blocked {
  color: var(--vscode-errorForeground);
}

details {
  font-size: 12px;
}

details summary {
  cursor: pointer;
}

.table-region {
  min-width: 0;
  overflow-x: auto;
  border: 1px solid var(--vscode-panel-border);
  border-radius: 5px;
}

.table-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: end;
  margin: 0 0 8px;
}

.table-filter {
  display: grid;
  flex: 1 1 240px;
  gap: 4px;
  font-weight: 600;
}

.table-filter-status {
  flex: 1 0 100%;
  margin: 0;
  font-size: 12px;
}

table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

th,
td {
  padding: 8px;
  vertical-align: top;
  border-bottom: 1px solid var(--vscode-panel-border);
  overflow-wrap: anywhere;
}

th {
  color: var(--vscode-foreground);
  background: var(--vscode-editorGroupHeader-tabsBackground);
  font-weight: 600;
}

th button {
  width: 100%;
  min-height: 0;
  padding: 0;
  text-align: left;
  color: inherit;
  background: transparent;
  border: 0;
}

tr:last-child td {
  border-bottom: 0;
}

tr[aria-selected="true"] {
  color: var(--vscode-list-activeSelectionForeground);
  background: var(--vscode-list-activeSelectionBackground);
}

.cell-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.cell-actions button {
  min-height: 28px;
}

.state-panel {
  max-width: 72ch;
  padding: 16px;
  border: 1px solid var(--vscode-panel-border);
  border-radius: 5px;
}

.state-panel[role="alert"] {
  border-color: var(--vscode-inputValidation-errorBorder);
}

.state-panel progress {
  width: 100%;
  margin: 12px 0;
}

.run-stepper {
  margin: 0;
  padding-left: 24px;
}

.run-stepper li {
  padding: 6px 0;
}

.run-stepper button[aria-current="step"] {
  outline: 1px solid var(--vscode-focusBorder);
  outline-offset: 1px;
}

.identifier {
  font-family: var(--vscode-editor-font-family);
  font-size: 12px;
  overflow-wrap: anywhere;
}

.studio-inspector {
  padding: 16px;
  border-left: 1px solid var(--vscode-panel-border);
}

.studio-footer {
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  align-items: center;
  min-height: 32px;
  padding: 6px 16px;
  color: var(--vscode-statusBar-foreground);
  background: var(--vscode-statusBar-background);
  border-top: 1px solid var(--vscode-panel-border);
  font-size: 12px;
}

.live-region {
  position: fixed;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}

@media (max-width: 719px) {
  .studio-shell {
    display: block;
  }

  .studio-rail {
    display: none;
  }

  .studio-mobile-nav {
    display: block;
  }

  .studio-workspace,
  .studio-workspace.with-inspector {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    padding: 16px;
  }

  .studio-inspector {
    border-top: 1px solid var(--vscode-panel-border);
    border-left: 0;
  }

  .studio-footer {
    margin-top: 16px;
  }
}

@media (max-width: 479px) {
  .studio-workspace {
    padding: 12px;
  }

  .record-field,
  .definition-columns,
  .progress-row,
  .issue-row,
  .event-row,
  .plain-row {
    grid-template-columns: minmax(0, 1fr);
  }

  .action-row button {
    width: 100%;
  }

  .table-controls > button,
  .table-filter {
    width: 100%;
    flex-basis: 100%;
  }
}

@media (forced-colors: active) {
  button,
  input,
  select,
  textarea,
  .grouped-section,
  .table-region,
  .state-panel,
  .studio-inspector,
  .studio-footer,
  .studio-rail {
    border-color: CanvasText;
  }

  button:focus-visible,
  select:focus-visible,
  input:focus-visible,
  textarea:focus-visible,
  a:focus-visible,
  [tabindex]:focus-visible {
    outline-color: Highlight;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    transition: none !important;
    animation: none !important;
  }
}
`
