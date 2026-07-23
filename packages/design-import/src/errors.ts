export type PortableDesignImportErrorCode =
  | "invalid-manifest"
  | "invalid-json"
  | "unsafe-path"
  | "unexpected-inventory"
  | "limit-exceeded"
  | "file-changed"
  | "digest-mismatch"
  | "unsupported-content"
  | "secret-shaped-content"

export class PortableDesignImportError extends Error {
  override readonly name = "PortableDesignImportError"

  constructor(
    readonly code: PortableDesignImportErrorCode,
    message: string,
  ) {
    super(message)
  }
}
