import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { ROOT, loadProjectionContext, renderGuideline, renderMarketDecisionSupport, sha256 } from "./lib/guideline_projection.mjs";

const context = loadProjectionContext();
const outputPath = path.join(ROOT, context.manifest.generation.outputPath);
const rendered = fs.readFileSync(outputPath, "utf8");
const decisionSupportOutputPath = path.join(ROOT, context.manifest.generation.decisionSupportOutputPath);
const renderedDecisionSupport = fs.readFileSync(decisionSupportOutputPath, "utf8");

test("actual bundled Guide passes deterministic drift check", () => {
  const result = spawnSync(process.execPath, [path.join(ROOT, "scripts/render_guideline.mjs"), "--check"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
});

test("actual bundled Guide is byte-identical to a fresh render", () => {
  assert.equal(rendered, renderGuideline(context));
  assert.equal(renderedDecisionSupport, renderMarketDecisionSupport(context));
});

test("projection binds exact manifest and canonical source digests", () => {
  for (const binding of context.manifest.canonicalSources.filter(entry => ["methodology-catalog", "market-registry"].includes(entry.kind))) {
    assert.ok(rendered.includes(binding.identity));
    assert.ok(rendered.includes(binding.version));
    assert.ok(rendered.includes(binding.sha256));
  }
  assert.equal(sha256(context.rawSources.get("market-registry")), context.manifest.canonicalSources.find(entry => entry.kind === "market-registry").sha256);
});

test("Guide has the exact progressive four-layer structure", () => {
  assert.deepEqual([...rendered.matchAll(/^## (\d\. .+)$/gm)].map(match => match[1]), [
    "1. Executive orientation",
    "2. Start here",
    "3. Practitioner guide",
    "4. Methodology and maintainer appendix",
  ]);
});

test("every required visual is vertical and host-theme compatible", () => {
  const visualIds = [...rendered.matchAll(/<!-- GAEP-VISUAL:([^ ]+) -->/g)].map(match => match[1]);
  assert.equal(new Set(visualIds).size, visualIds.length, "generated visual identities must be unique");
  for (const visual of context.manifest.requiredVisuals) {
    assert.ok(visualIds.includes(visual.visualId), `missing required visual ${visual.visualId}`);
  }
  assert.doesNotMatch(rendered, /flowchart\s+(?:LR|RL)\b/);
  assert.doesNotMatch(rendered, /(?:fill|stroke|color):#[a-f0-9]{3,8}/i);
  assert.doesNotMatch(rendered, /%%\{init:/);
  const mermaidCount = (rendered.match(/```mermaid\n/g) ?? []).length;
  assert.equal((rendered.match(/flowchart TD\n/g) ?? []).length, visualIds.length);
  assert.ok(mermaidCount >= visualIds.length, "sequence diagrams may supplement declared vertical flow visuals");
  assert.equal((rendered.match(/\n```\n/g) ?? []).length >= mermaidCount, true);
});

test("narrow-pane structure avoids oversized Markdown tables", () => {
  for (const line of `${rendered}\n${renderedDecisionSupport}`.split("\n").filter(line => line.startsWith("|"))) {
    assert.ok((line.match(/\|/g) ?? []).length <= 5, `table has more than four columns: ${line}`);
  }
});

test("all Products have official links while methodologies remain separate", () => {
  for (const product of context.market.products) assert.match(renderedDecisionSupport, new RegExp(`\\[${product.canonicalName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\]\\(${product.officialUri.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\)`));
  const productBlock = renderedDecisionSupport.slice(renderedDecisionSupport.indexOf("## Evaluated Product identities"), renderedDecisionSupport.indexOf("## Methodologies and references"));
  for (const methodology of context.market.methodologyBindings) assert.doesNotMatch(productBlock, new RegExp(methodology.canonicalName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("Guide contains no broken local Markdown link", () => {
  for (const [artifactPath, artifact] of [[outputPath, rendered], [decisionSupportOutputPath, renderedDecisionSupport]]) {
    const targets = [...artifact.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)].map(match => match[1]);
    const local = targets.filter(target => !/^https?:\/\//.test(target) && !target.startsWith("#"));
    for (const target of local) assert.ok(fs.existsSync(path.resolve(path.dirname(artifactPath), target.split("#", 1)[0])), `broken local Guide link ${target}`);
  }
});

test("extension package bundles the maintained Guide and contributes its open command", () => {
  assert.ok(context.extensionPackage.files.includes("media/GAEP_GUIDE.md"));
  assert.ok(context.extensionPackage.files.includes("media/GAEP_MARKET_DECISION_GUIDE.md"));
  assert.ok(context.extensionPackage.activationEvents.includes("onCommand:gaep.openGuide"));
  assert.ok(context.extensionPackage.contributes.commands.some(entry => entry.command === "gaep.openGuide"));
});

test("aggregate Guideline command begins with canonical validation and ends with drift check", () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  assert.match(packageJson.scripts["test:guideline"] ?? "", /^npm run validate:guideline && /);
  assert.match(packageJson.scripts["test:guideline"] ?? "", / && npm run check:guideline-projection$/);
  assert.match(packageJson.scripts.check ?? "", /npm run test:guideline/);
});
