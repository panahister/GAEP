/// <reference lib="dom" />

import "../../src/studio-client.js"
import { studioStyles } from "../../src/studio-styles.js"
import {
  createStudioVisualFixture,
  getStudioVisualFixtureScenario,
} from "../../src/studio-visual-fixtures.js"
import { studioProtocolVersion } from "../../src/studio-protocol.js"

const parameters = new URLSearchParams(window.location.search)
const scenario = getStudioVisualFixtureScenario(parameters.get("scenario") ?? "")
const snapshot = createStudioVisualFixture(scenario.id)

const lightTheme = {
  foreground: "#24292f",
  description: "#57606a",
  editor: "#ffffff",
  sidebar: "#f6f8fa",
  panel: "#d0d7de",
  widget: "#afb8c1",
  button: "#0969da",
  buttonForeground: "#ffffff",
  buttonHover: "#0550ae",
  secondary: "#eaeef2",
  secondaryForeground: "#24292f",
  secondaryHover: "#d8dee4",
  selected: "#ddf4ff",
  selectedForeground: "#24292f",
  hover: "#eaeef2",
  input: "#ffffff",
  inputForeground: "#24292f",
  focus: "#0969da",
  error: "#cf222e",
  warning: "#9a6700",
  tabs: "#f6f8fa",
  status: "#0969da",
  statusForeground: "#ffffff",
}

const darkTheme = {
  foreground: "#e6edf3",
  description: "#8b949e",
  editor: "#0d1117",
  sidebar: "#161b22",
  panel: "#30363d",
  widget: "#484f58",
  button: "#238636",
  buttonForeground: "#ffffff",
  buttonHover: "#2ea043",
  secondary: "#21262d",
  secondaryForeground: "#e6edf3",
  secondaryHover: "#30363d",
  selected: "#1f6feb",
  selectedForeground: "#ffffff",
  hover: "#21262d",
  input: "#0d1117",
  inputForeground: "#e6edf3",
  focus: "#58a6ff",
  error: "#f85149",
  warning: "#d29922",
  tabs: "#161b22",
  status: "#238636",
  statusForeground: "#ffffff",
}

const theme = scenario.theme === "dark" ? darkTheme : lightTheme
const variables = String.raw`
:root {
  --vscode-font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --vscode-editor-font-family: ui-monospace, "SFMono-Regular", Menlo, monospace;
  --vscode-font-size: 13px;
  --vscode-foreground: ${theme.foreground};
  --vscode-descriptionForeground: ${theme.description};
  --vscode-editor-background: ${theme.editor};
  --vscode-sideBar-background: ${theme.sidebar};
  --vscode-sideBar-foreground: ${theme.foreground};
  --vscode-panel-border: ${theme.panel};
  --vscode-widget-border: ${theme.widget};
  --vscode-button-background: ${theme.button};
  --vscode-button-foreground: ${theme.buttonForeground};
  --vscode-button-hoverBackground: ${theme.buttonHover};
  --vscode-button-secondaryBackground: ${theme.secondary};
  --vscode-button-secondaryForeground: ${theme.secondaryForeground};
  --vscode-button-secondaryHoverBackground: ${theme.secondaryHover};
  --vscode-list-activeSelectionBackground: ${theme.selected};
  --vscode-list-activeSelectionForeground: ${theme.selectedForeground};
  --vscode-list-hoverBackground: ${theme.hover};
  --vscode-input-background: ${theme.input};
  --vscode-input-foreground: ${theme.inputForeground};
  --vscode-input-border: ${theme.widget};
  --vscode-focusBorder: ${theme.focus};
  --vscode-errorForeground: ${theme.error};
  --vscode-inputValidation-errorBorder: ${theme.error};
  --vscode-inputValidation-warningBorder: ${theme.warning};
  --vscode-editorGroupHeader-tabsBackground: ${theme.tabs};
  --vscode-statusBar-background: ${theme.status};
  --vscode-statusBar-foreground: ${theme.statusForeground};
}
`
const style = document.createElement("style")
style.nonce = "visual_fixture_nonce_1234567890"
style.textContent = `${variables}\n${studioStyles}`
document.head.append(style)
document.documentElement.style.colorScheme = scenario.theme

window.postMessage({
  protocolVersion: studioProtocolVersion,
  channelId: "visual_fixture_channel_1234567890",
  type: "studio.snapshot",
  snapshot,
})

requestAnimationFrame(() => requestAnimationFrame(() => {
  const tables = document.querySelectorAll("section[data-studio-table]").length
  document.body.dataset.visualReady = "true"
  document.body.dataset.visualScenario = scenario.id
  document.body.dataset.visualRoute = scenario.route
  document.body.dataset.visualSurface = scenario.surface
  document.body.dataset.visualTables = String(tables)
  document.body.dataset.visualInnerWidth = String(window.innerWidth)
  document.body.dataset.visualInnerHeight = String(window.innerHeight)
  document.title = `GAEP visual fixture ready: ${scenario.id}`
}))
