import { describe, expect, it } from "vitest"

import { extensionId, installArgs, listArgs, riderProperties, uninstallArgs } from "./local_extension_acceptance.mjs"

describe("local isolated extension acceptance command construction", () => {
  it("uses independent VS Code and Kiro identities", () => {
    expect(extensionId("vscode")).toBe("gaep.gaep-vscode")
    expect(extensionId("kiro")).toBe("gaep.gaep-kiro")
  })

  it("always supplies isolated user-data and extension directories", () => {
    expect(installArgs("/tmp/user", "/tmp/ext", "/tmp/a.vsix")).toEqual([
      "--user-data-dir", "/tmp/user", "--extensions-dir", "/tmp/ext", "--install-extension", "/tmp/a.vsix", "--force",
    ])
    expect(listArgs("/tmp/user", "/tmp/ext")).toEqual([
      "--user-data-dir", "/tmp/user", "--extensions-dir", "/tmp/ext", "--list-extensions", "--show-versions",
    ])
    expect(uninstallArgs("/tmp/user", "/tmp/ext", "gaep.gaep-vscode")).toEqual([
      "--user-data-dir", "/tmp/user", "--extensions-dir", "/tmp/ext", "--uninstall-extension", "gaep.gaep-vscode",
    ])
  })

  it("isolates every Rider state directory", () => {
    const properties = riderProperties("/tmp/rider-acceptance")
    expect(properties).toContain("idea.config.path=/tmp/rider-acceptance/config")
    expect(properties).toContain("idea.system.path=/tmp/rider-acceptance/system")
    expect(properties).toContain("idea.plugins.path=/tmp/rider-acceptance/plugins")
    expect(properties).toContain("idea.log.path=/tmp/rider-acceptance/log")
  })
})
