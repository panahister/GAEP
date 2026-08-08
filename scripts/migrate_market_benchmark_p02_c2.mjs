import fs from "node:fs";
import { spawnSync } from "node:child_process";

import { canonicalJson, REGISTRY_PATH, ROOT } from "./lib/market_benchmark_registry.mjs";

// One-time, deterministic v0.2.0 -> v0.2.1 migration. Repository proof is
// resolved from each assertion's historical asOfCommit, never the worktree.

const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf8"));
registry.version = "0.2.1";
registry.schemaVersion = "2.1.0";
registry.schemaId = "https://gaep.example/schemas/market-evidence-benchmark-registry-2.1.0.schema.json";
registry.projection = {
  documentId: registry.projection.documentId,
  documentVersion: "0.4.1",
  path: registry.projection.path,
  generatedSections: registry.projection.generatedSections,
  registryVersion: registry.version,
  capabilityCount: registry.projection.capabilityCount,
};

const activeAssertionByEvidenceId = new Map();
for (const assertion of registry.evidenceAssertions) {
  if (assertion.status === "active" && !activeAssertionByEvidenceId.has(assertion.evidenceId)) activeAssertionByEvidenceId.set(assertion.evidenceId, assertion);
}

for (const evidence of registry.evidence) {
  const assertion = activeAssertionByEvidenceId.get(evidence.evidenceId)
    ?? registry.evidenceAssertions.find(candidate => candidate.evidenceId === evidence.evidenceId);
  if (!assertion) throw new Error(`${evidence.evidenceId}: no assertion supplies canonical subject migration`);
  evidence.subjectType = assertion.subjectType;
  evidence.productId = assertion.productId;
  evidence.methodologyId = assertion.methodologyId;
  evidence.excludedIdentityId = assertion.excludedIdentityId;
}

// SAP was migrated from an evaluated Product to an explicit excluded identity in v0.2.0.
// Preserve the superseded assertion while aligning its subject with the canonical Evidence owner.
const legacySapAssertion = registry.evidenceAssertions.find(assertion => assertion.assertionId === "GAEP-AST-057");
legacySapAssertion.subjectType = "excluded-identity";
legacySapAssertion.productId = null;
legacySapAssertion.methodologyId = null;
legacySapAssertion.excludedIdentityId = "GAEP-EXC-002";
legacySapAssertion.migrationNote = "Historical SAP identity assertion aligned to the canonical excluded-identity subject in registry v0.2.1.";

const pathReplacement = new Map([
  ["packages/agent-sdk/src/provider-selection.ts", "packages/contracts/src/provider-switch-implementation.ts"],
  ["packages/contracts/src/evidence.ts", "packages/contracts/src/evidence-registry.ts"],
  ["packages/contracts/src/product-journey.ts", "packages/contracts/src/user-journey-model.ts"],
  ["packages/engine/src/initiative-entry-workflow.ts", "packages/engine/src/initiative-entry.ts"],
]);

const additionalActiveProof = new Map([
  ["GAEP-REP-020", ["packages/contracts/src/source-governance.test.ts", "packages/engine/src/source-governance.test.ts"]],
  ["GAEP-REP-021", ["packages/contracts/src/source-governance.test.ts", "packages/engine/src/source-governance.test.ts"]],
  ["GAEP-REP-022", ["packages/contracts/src/source-governance.test.ts", "packages/engine/src/source-governance.test.ts"]],
  ["GAEP-REP-024", ["packages/contracts/src/initiative-entry-workflow.test.ts", "packages/engine/src/initiative-entry.test.ts"]],
  ["GAEP-REP-025", ["packages/contracts/src/initiative-entry-workflow.test.ts", "packages/engine/src/initiative-entry.test.ts"]],
  ["GAEP-REP-026", ["packages/contracts/src/initiative-entry-workflow.test.ts", "packages/engine/src/initiative-entry.test.ts"]],
  ["GAEP-REP-044", ["docs/next/99_Registries_and_References/004_DEFERRED_CAPABILITY_REGISTER.md"]],
]);

function runGit(args) {
  const result = spawnSync("git", args, { cwd: ROOT, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr.trim()}`);
  return result.stdout.trim();
}

function roleFor(repositoryPath) {
  if (/\.test\.[cm]?[jt]s$/.test(repositoryPath)) return "test";
  if (repositoryPath.startsWith(".github/workflows/") || repositoryPath.startsWith("scripts/")) return "workflow";
  if (repositoryPath.startsWith("docs/") || repositoryPath.endsWith(".md")) return "documentation";
  if (repositoryPath.includes("/contracts/")) return "contract";
  return "implementation";
}

function proofAt(commit, repositoryPath) {
  const line = runGit(["ls-tree", commit, "--", repositoryPath]);
  const match = /^(\d+)\s+(\w+)\s+([a-f0-9]+)\t(.+)$/.exec(line);
  if (!match || match[2] !== "blob" || match[1] === "120000" || match[4] !== repositoryPath) {
    throw new Error(`${repositoryPath}: expected an exact non-symlink Git blob at ${commit}`);
  }
  return {
    path: repositoryPath,
    role: roleFor(repositoryPath),
    gitBlobObjectId: match[3],
    locator: null,
  };
}

for (const assertion of registry.repositoryAssertions) {
  const originalPaths = assertion.repositoryPaths ?? assertion.repositoryEvidence?.map(entry => entry.path) ?? [];
  const replacedPaths = originalPaths.map(repositoryPath => pathReplacement.get(repositoryPath) ?? repositoryPath);
  const extraPaths = assertion.status === "active" ? additionalActiveProof.get(assertion.repositoryAssertionId) ?? [] : [];
  const exactPaths = [...new Set([...replacedPaths, ...extraPaths])].sort();
  assertion.repositoryEvidence = exactPaths.map(repositoryPath => proofAt(assertion.asOfCommit, repositoryPath));
  delete assertion.repositoryPaths;
}

fs.writeFileSync(REGISTRY_PATH, canonicalJson(registry));
