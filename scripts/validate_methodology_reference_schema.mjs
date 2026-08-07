#!/usr/bin/env node

import {
  AJV_FORMATS_VERSION,
  AJV_VERSION,
  formatAjvErrors,
  validateCanonicalCatalog,
} from "./lib/methodology_reference_schema.mjs";

try {
  const result = validateCanonicalCatalog();
  if (!result.valid) {
    console.error("methodology reference catalog JSON Schema validation: FAIL");
    console.error(formatAjvErrors(result.errors));
    process.exitCode = 1;
  } else {
    console.log(
      `methodology reference catalog JSON Schema validation: PASS (Ajv ${AJV_VERSION}; ajv-formats ${AJV_FORMATS_VERSION}; Draft 2020-12; strict; allErrors; offline)`,
    );
  }
} catch (error) {
  console.error("methodology reference catalog JSON Schema validation: FAIL");
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
}
