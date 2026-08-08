#!/usr/bin/env node

import {
  METHODOLOGY_CATALOG_PATH,
  REGISTRY_PATH,
  SCHEMA_PATH,
  validateRegistryFiles,
} from "./lib/market_benchmark_registry.mjs";

function parseArgs(argv) {
  const options = {
    registryPath: REGISTRY_PATH,
    schemaPath: SCHEMA_PATH,
    methodologyCatalogPath: METHODOLOGY_CATALOG_PATH,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];
    if (argument === "--registry" && value) options.registryPath = value;
    else if (argument === "--schema" && value) options.schemaPath = value;
    else if (argument === "--methodology-catalog" && value) options.methodologyCatalogPath = value;
    else throw new Error(`unknown or incomplete argument: ${argument}`);
    index += 1;
  }
  return options;
}

try {
  const result = validateRegistryFiles(parseArgs(process.argv.slice(2)));
  if (!result.valid) {
    console.error("Market benchmark registry validation failed:");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log(
      `Market benchmark registry valid: ${result.registry.products.length} products, ` +
        `${result.registry.evidence.length} evidence records, ` +
        `${result.registry.benchmarkRows.reduce((count, row) => count + row.cells.length, 0)} benchmark cells.`,
    );
  }
} catch (error) {
  console.error(`Market benchmark registry validation failed: ${error.message}`);
  process.exitCode = 1;
}
