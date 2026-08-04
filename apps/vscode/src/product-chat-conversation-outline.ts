export interface ProductChatConversationTurn {
  command?: string
  prompt: string
  response: string
}

const escapeHtml = (value: string): string => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;")

const compact = (value: string): string => value.replace(/\s+/g, " ").trim()

const turnLabel = (turn: ProductChatConversationTurn, index: number): string => {
  const command = turn.command?.trim()
  const prompt = compact(turn.prompt)
  const subject = command ? `/${command}` : prompt || "GAEP request"
  const suffix = command && prompt ? ` · ${prompt}` : ""
  const label = `${index + 1}. ${subject}${suffix}`
  return label.length > 96 ? `${label.slice(0, 93)}…` : label
}

export function productChatConversationOutlineHtml(turns: readonly ProductChatConversationTurn[]): string {
  const navigation = turns.map((turn, index) => [
    `<li><a href="#turn-${index + 1}">`,
    escapeHtml(turnLabel(turn, index)),
    "</a></li>",
  ].join(""))
  const transcript = turns.map((turn, index) => [
    `<article id="turn-${index + 1}" tabindex="-1">`,
    `<h2>${escapeHtml(turnLabel(turn, index))}</h2>`,
    '<div class="role">Request</div>',
    `<pre>${escapeHtml(turn.prompt || (turn.command ? `/${turn.command}` : "GAEP request"))}</pre>`,
    '<div class="role">GAEP response</div>',
    `<pre>${escapeHtml(turn.response || "No textual response was emitted.")}</pre>`,
    '<a class="back" href="#outline">Back to outline</a>',
    "</article>",
  ].join(""))

  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    "<style>",
    ":root{color-scheme:light dark}*{box-sizing:border-box}html{scroll-behavior:smooth}",
    "body{margin:0;color:var(--vscode-foreground);background:var(--vscode-editor-background);font-family:var(--vscode-font-family)}",
    ".layout{display:grid;grid-template-columns:minmax(220px,28%) 1fr;min-height:100vh}",
    "nav{position:sticky;top:0;height:100vh;overflow:auto;padding:20px 16px;border-right:1px solid var(--vscode-panel-border);background:var(--vscode-sideBar-background)}",
    "main{min-width:0;padding:24px 32px}h1{font-size:20px;margin:0 0 8px}h2{font-size:18px;line-height:1.35;margin:0 0 18px}",
    ".note{font-size:12px;color:var(--vscode-descriptionForeground);margin:0 0 20px}ol{padding-left:22px;margin:0}li{margin:0 0 9px}",
    "a{color:var(--vscode-textLink-foreground);text-decoration:none}a:hover{text-decoration:underline}",
    "article{scroll-margin-top:18px;padding:22px 0 34px;border-bottom:1px solid var(--vscode-panel-border)}article:target h2{color:var(--vscode-textLink-foreground)}",
    ".role{margin:16px 0 7px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--vscode-descriptionForeground)}",
    "pre{white-space:pre-wrap;overflow-wrap:anywhere;padding:14px;border:1px solid var(--vscode-panel-border);border-radius:6px;background:var(--vscode-textCodeBlock-background);font:var(--vscode-editor-font-size)/1.55 var(--vscode-editor-font-family)}",
    ".back{display:inline-block;margin-top:12px}@media(max-width:760px){.layout{grid-template-columns:1fr}nav{position:relative;height:auto;border-right:0;border-bottom:1px solid var(--vscode-panel-border)}main{padding:18px}}",
    "</style>",
    "</head>",
    "<body>",
    '<div class="layout">',
    '<nav id="outline">',
    "<h1>Conversation Outline</h1>",
    '<p class="note">Session-only navigation. This transcript is not a governed Source or Evidence record.</p>',
    `<ol>${navigation.join("")}</ol>`,
    "</nav>",
    `<main>${transcript.join("")}</main>`,
    "</div>",
    "</body>",
    "</html>",
  ].join("")
}
