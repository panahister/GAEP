export function assertManagedRunLaunchAvailable(): void {
  throw new Error(
    "Managed Run launch is blocked in Phase 2. Complete and verify the Phase 3 host wiring before preparing or starting any provider Run from VS Code.",
  )
}
