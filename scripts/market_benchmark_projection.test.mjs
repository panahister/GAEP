import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { REGISTRY_PATH, ROOT, readJson } from "./lib/market_benchmark_registry.mjs";

const registry = readJson(REGISTRY_PATH);
const projectionPath = path.join(ROOT, registry.projection.path);
const projection = fs.readFileSync(projectionPath, "utf8");

test("actual generated human projection passes deterministic drift check", () => {
  const result = spawnSync(process.execPath, [path.join(ROOT, "scripts/render_market_benchmark.mjs"), "--check"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
});

test("projection binds exact canonical identity, version, digest, and research date", () => {
  const digest = crypto.createHash("sha256").update(fs.readFileSync(REGISTRY_PATH)).digest("hex");
  assert.match(projection, new RegExp(`${registry.registryId} v${registry.version}`));
  assert.match(projection, new RegExp(digest));
  assert.match(projection, new RegExp(registry.researchAsOf));
});

test("projection contains every required P02 human section", () => {
  for (const section of registry.projection.generatedSections) {
    assert.ok(projection.toLowerCase().includes(section.toLowerCase()), `missing generated section ${section}`);
  }
});

test("projection includes every evaluated Product identity", () => {
  for (const product of registry.products) assert.ok(projection.includes(product.canonicalName), `missing ${product.productId}`);
});

test("projection legend preserves Unknown and evidence-state distinctions", () => {
  for (const label of ["Verified", "Partial", "Unsupported by reviewed evidence", "Unknown", "N/A"]) assert.match(projection, new RegExp(label));
  assert.match(projection, /Unknown means not assessed or not established by reviewed evidence; it never means No/);
});

test("projection separates Product identities from methodologies and preserves ambiguous seeds", () => {
  assert.match(projection, /AWS AI-DLC is treated as a methodology rather than a vendor product/);
  assert.match(projection, /SpecFlow BDD project and the current GitHub Spec Kit are distinct identities/);
});

test("projection carries P01 naming without approving it", () => {
  assert.match(projection, /Governed AI Engineering Platform/);
  assert.match(projection, /Proposed — awaiting explicit Product Owner acceptance/);
  assert.match(projection, /P02 preserves the P01 naming recommendation; it does not reopen, approve, or replace it/);
});

test("projection contains readable Markdown rather than a raw JSON payload", () => {
  assert.match(projection, /^# Evidence-Governed Market Category/m);
  assert.doesNotMatch(projection, /^\s*\{\s*"registryId"/m);
  assert.doesNotMatch(projection, /"benchmarkRows"\s*:/);
});

test("projection blocks winner scoring and public authority", () => {
  assert.match(projection, /not a score or ranking/);
  assert.match(projection, /No aggregate winner score is permitted/);
  assert.match(projection, /not approved/);
  assert.match(projection, /not published/);
});
