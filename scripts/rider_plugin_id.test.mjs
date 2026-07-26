import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..")
const EXPECTED_ID = "dev.gaep.platform"

describe("Rider plugin ID invariant (JetBrains verifier: must not contain 'rider')", () => {
  it("plugin.xml <id> and the runtime PluginId lookup are identical and equal dev.gaep.platform", () => {
    const pluginXml = readFileSync(join(repoRoot, "apps/rider/src/main/resources/META-INF/plugin.xml"), "utf8")
    const factory = readFileSync(join(repoRoot, "apps/rider/src/main/kotlin/dev/gaep/rider/GaepToolWindowFactory.kt"), "utf8")

    const xmlId = /<id>([^<]+)<\/id>/.exec(pluginXml)?.[1]
    const lookupId = /PluginId\.getId\("([^"]+)"\)/.exec(factory)?.[1]

    expect(xmlId).toBe(EXPECTED_ID)
    expect(lookupId).toBe(EXPECTED_ID)
    expect(xmlId).toBe(lookupId)
    // The plugin ID must not contain the word 'rider' (the JetBrains verifier rejects it).
    expect(xmlId).not.toContain("rider")
  })
})
