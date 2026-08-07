#!/usr/bin/env node

import {
  AJV_FORMATS_VERSION,
  AJV_VERSION,
  formatAjvErrors,
  validateCatalogFiles,
} from "./lib/methodology_reference_schema.mjs";

function parseArguments(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (!["--catalog", "--schema"].includes(flag)) {
      throw new Error(`unknown argument: ${flag}`);
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`missing value for ${flag}`);
    }
    const key = flag === "--catalog" ? "catalogPath" : "schemaPath";
    if (options[key]) {
      throw new Error(`duplicate argument: ${flag}`);
    }
    options[key] = value;
    index += 1;
  }
  return options;
}

try {
  const result = validateCatalogFiles(parseArguments(process.argv.slice(2)));
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
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
