import { describe, expect, it } from "vitest"

import { deliveryTableKeys, isStudioSnapshot } from "./studio-protocol.js"
import {
  createStudioVisualFixture,
  getStudioVisualFixtureScenario,
  studioVisualFixtureScenarios,
} from "./studio-visual-fixtures.js"

describe("Product Studio offline visual fixtures", () => {
  it("defines an exact bounded matrix across routes, states, themes, and responsive widths", () => {
    expect(studioVisualFixtureScenarios).toHaveLength(6)
    expect(new Set(studioVisualFixtureScenarios.map(({ id }) => id)).size).toBe(6)
    expect(new Set(studioVisualFixtureScenarios.map(({ route }) => route))).toEqual(
      new Set(["overview", "delivery", "scope", "trace"]),
    )
    expect(new Set(studioVisualFixtureScenarios.map(({ surface }) => surface))).toEqual(
      new Set(["ready", "empty", "invalid"]),
    )
    expect(studioVisualFixtureScenarios.some(({ width }) => width >= 480 && width < 720)).toBe(true)
    expect(studioVisualFixtureScenarios.some(({ width }) => width >= 1200)).toBe(true)
    expect(new Set(studioVisualFixtureScenarios.map(({ theme }) => theme))).toEqual(new Set(["light", "dark"]))
  })

  it("creates strict protocol-valid snapshots for every fixture", () => {
    for (const scenario of studioVisualFixtureScenarios) {
      const snapshot = createStudioVisualFixture(scenario.id)
      expect(isStudioSnapshot(snapshot), scenario.id).toBe(true)
      expect(snapshot.route).toBe(scenario.route)
      expect(snapshot.surface.kind).toBe(scenario.surface)
      expect(JSON.stringify(snapshot)).not.toMatch(/\/Users\/|\/home\/|C:\\Users\\/u)
    }
  })

  it("binds the Delivery fixture to every declared table exactly once", () => {
    const snapshot = createStudioVisualFixture("delivery-tables-wide")
    expect(snapshot.page.kind).toBe("delivery")
    if (snapshot.page.kind !== "delivery") throw new Error("Expected Delivery fixture")
    const page = snapshot.page
    expect(deliveryTableKeys.filter((key) => page[key] !== undefined)).toEqual(deliveryTableKeys)
    expect(new Set(deliveryTableKeys.map((key) => page[key]?.id)).size).toBe(deliveryTableKeys.length)
  })

  it("rejects unknown fixture identifiers", () => {
    expect(() => getStudioVisualFixtureScenario("unknown-fixture")).toThrow(/Unknown Product Studio visual fixture/u)
  })
})
