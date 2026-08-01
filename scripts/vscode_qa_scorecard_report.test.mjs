import assert from "node:assert/strict"
import test from "node:test"
import { composeQaScorecardReport } from "./vscode_qa_scorecard_report.mjs"

const ids = ["functional", "unit-integration", "e2e", "security", "accessibility", "visual-fixture", "performance", "reliability", "trace-coverage", "unresolved-gaps"]
const paths = ["evidence/vscode-checkpoints/20260801T072843Z-p3b18-unit-integration-testing.json", "evidence/vscode-checkpoints/20260801T072843Z-p3b18-unit-integration-testing.json",
  "evidence/vscode-checkpoints/20260801T074130Z-p3b19-local-vscode-e2e.json", "evidence/vscode-checkpoints/20260801T083625Z-p3b20-local-security.json",
  "evidence/vscode-checkpoints/20260801T084802Z-p3b21-accessibility.json", "apps/vscode/test/visual/baselines/p3b22/manifest.json",
  "evidence/vscode-checkpoints/20260801T092415Z-p3b23-performance-reliability.json", "evidence/vscode-checkpoints/20260801T092415Z-p3b23-performance-reliability.json",
  "evidence/vscode-checkpoints/20260731T213608Z-p3b17-test-generation.json", "docs/06_Roadmap/054_GAEP_FEATURE_DELIVERY_TRACKER.md"]
function sources() {
  const p18 = { verification: { focused: { status: "passed" }, sharedAndVscode: { status: "passed" } } }
  const values = [p18, p18, { result: "passed" }, { result: "passed-with-open-acceptance-gates" }, { result: "automated-passed-manual-pending" },
    { kind: "gaep-vscode-product-studio-visual-baseline", scenarios: Array.from({ length: 6 }, (_, i) => ({ route: i ? "overview" : "delivery", dom: { tableCount: i ? 0 : 45 } })) },
    { result: "local-budgets-passed-native-power-loss-pending" }, { result: "local-budgets-passed-native-power-loss-pending" }, { verification: { focused: { status: "passed" } } }, undefined]
  return ids.map((id, index) => ({ id, path: paths[index], bytes: index + 10, sha256: String(index + 1).repeat(64).slice(0, 64), tests: index + 1, skipped: 0,
    ...(values[index] ? { json: values[index] } : { text: "P3B-24 Product Owner acceptance" }) }))
}
const base = () => ({ checkpoint: "a".repeat(40), observedAt: "2026-08-01T10:00:00.000Z", sources: sources(),
  focused: { status: "passed", files: 5, tests: 20, skipped: 0 }, visual: { status: "passed", scenarios: 6, deliveryTables: 45 } })
test("composes ten fail-closed dimensions without release authority", () => {
  const report = composeQaScorecardReport(base())
  assert.equal(report.scorecard.dimensions.length, 10); assert.equal(report.scorecard.successCount, 9)
  assert.equal(report.scorecard.notAssessedCount, 1); assert.equal(report.scorecard.releaseReadiness, "not-established")
})
test("rejects incomplete evidence, focused verification and visual catalogs", () => {
  assert.throws(() => composeQaScorecardReport({ ...base(), sources: sources().slice(1) }), /ten evidence/)
  assert.throws(() => composeQaScorecardReport({ ...base(), focused: { status: "passed", files: 4, tests: 20, skipped: 0 } }), /Focused/)
  assert.throws(() => composeQaScorecardReport({ ...base(), visual: { status: "passed", scenarios: 6, deliveryTables: 44 } }), /Visual/)
})
