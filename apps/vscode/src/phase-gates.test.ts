import { describe, expect, it } from "vitest"

import { assertManagedRunLaunchAvailable } from "./phase-gates.js"

describe("Founder phase gates", () => {
  it("fails closed before VS Code can prepare or launch a provider Run in Phase 2", () => {
    expect(() => assertManagedRunLaunchAvailable()).toThrow(/blocked in Phase 2.*Phase 3 host wiring/iu)
  })
})
