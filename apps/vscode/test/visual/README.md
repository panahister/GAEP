# Product Studio offline visual fixtures

P3B-22 renders the real Product Studio browser client from deterministic local snapshots. The harness binds six fixed scenarios, exact viewport PNG bytes, DOM readiness, all 44 Delivery tables, the scenario catalog, and the generated browser bundle to one recorded Chrome renderer fingerprint.

Run the current gate from the repository root:

```sh
npm run test:vscode:visual
```

The browser is confined to a loopback fixture server and is launched with external hostname resolution and background network features disabled. It does not call Figma, providers, or external systems and does not modify the normal VS Code profile.

Baseline replacement is deliberately fail-closed. `--update-baselines` succeeds only when no baseline manifest exists. Review renderer/source changes and the candidate PNGs explicitly before replacing the committed set; never treat a regenerated image as automatic design acceptance.

These fixtures establish exact renderer-bound PNG equality only. They do not establish live Figma equality, semantic or perceptual quality, native VS Code webview/display behavior, human design acceptance, Product Owner acceptance, release, publication, or deployment authority.
