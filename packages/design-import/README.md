# Portable design import

`@gaep/design-import` is GAEP's local, provider-neutral boundary for receiving a governed design export. It does not connect to Figma, use OAuth, parse proprietary `.fig` files, render untrusted content, or establish approval.

The initial contract accepts an exact `gaep-design-import.json` manifest plus these portable formats:

- PNG, JPEG, and WebP images;
- passive SVG without scripts, event handlers, external references, or active embedded content;
- PDF snapshots;
- DTCG-style design-token JSON using `$value`, optional `$type`, optional `$description`, and an optional credential-free HTTPS `$schema` at the root.

Every artifact has a normalized relative path, declared byte size, SHA-256 digest, media type, semantic kind, and optional Product targets. Import rejects absolute/traversing/Windows-ambiguous paths, links and special files, undeclared inventory, case collisions, changing files, digest drift, size/count overflow, duplicate JSON keys, prototype keys, malformed UTF-8, secret-shaped text/token values, active SVG, and mismatched file signatures.

Strict JSON parsing has fixed package security ceilings for input length, nesting, node count, string length, and key length. Callers may lower those limits for a narrower boundary but cannot raise them.

The result contains portable metadata, normalized token values, exact provenance digests, validation evidence, and this non-escalation boundary:

`import-validation-is-not-design-approval-or-baseline`

Source ownership, review, and approval fields are preserved as claims. The result always remains `pending-human-review` until a separate governed workflow validates and promotes it.

Token values are normalized structurally and digest-bound. Alias/reference resolution and token-type semantic validation remain downstream review work.

## Minimal manifest

```json
{
  "schemaVersion": 1,
  "kind": "portable-design-bundle",
  "id": "11111111-1111-4111-8111-111111111111",
  "productId": "22222222-2222-4222-8222-222222222222",
  "title": "Checkout design export",
  "classification": "internal",
  "owner": { "kind": "role", "id": "product-design-owner" },
  "source": {
    "tool": "figma",
    "objectId": "file-123",
    "revision": "revision-7",
    "exportMethod": "manual-export",
    "exportedAt": "2026-07-24T08:00:00.000Z"
  },
  "sourceReview": { "status": "unreviewed" },
  "artifacts": [
    {
      "id": "checkout-screen",
      "path": "screens/checkout.png",
      "kind": "screen",
      "format": "png",
      "mediaType": "image/png",
      "sizeBytes": 12345,
      "digest": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      "targets": [{ "kind": "requirement", "id": "CHECKOUT-REQ-1" }]
    }
  ]
}
```

The digest and size in the example are placeholders; imports fail unless they match the exact file.

## Deliberate first-slice limits

ZIP extraction, fonts, HTML/CSS/React source, vendor-specific variable JSON, visual decoding, previews, component/frame selection, delta analysis, persistence into `.gaep`, Product Studio UI, and human approval/baselining are later integration work. Live Figma access remains a separate, optional governed adapter phase.
