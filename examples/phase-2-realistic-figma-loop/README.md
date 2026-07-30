# Phase 2 realistic Figma loop example

This canonical fixture drives one deterministic, candidate-only GAEP-to-Figma-to-GAEP evidence loop for the Atlas Evidence Review Product and Initiative.

It intentionally performs no external operation. The generated artifact contains:

- 12 ordered loop stages;
- all 23 governed Phase 2 source candidates;
- the exact Phase 2 UX/Figma and integrated Change, Impact, Agent and Model dashboards;
- four host-projection bindings to the sealed conformance evidence;
- three fail-closed permission, stale-target, and return-conflict recovery cases;
- a receipt and complete byte inventory.

Generate a new artifact only into an absent directory:

```sh
npm run example:phase2-figma-loop -- evidence/examples/<timestamp>-phase-2-realistic-figma-loop
```

Verify an existing artifact:

```sh
npm run verify:example:phase2-figma-loop -- evidence/examples/<timestamp>-phase-2-realistic-figma-loop
```

The fixture is local evidence only. It does not connect to Figma or a provider, request credentials, grant permissions, transfer content, write, import, approve, designate a Baseline Set, establish readiness, change implementation, or grant action, security, release, or deployment authority.
