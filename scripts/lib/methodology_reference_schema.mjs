import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const require = createRequire(import.meta.url);
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(SCRIPT_DIR, "../..");
export const CATALOG_PATH = path.join(
  ROOT,
  "docs/next/99_Registries_and_References/011_METHODOLOGY_REFERENCE_CATALOG.json",
);
export const SCHEMA_PATH = path.join(
  ROOT,
  "docs/next/99_Registries_and_References/011_METHODOLOGY_REFERENCE_CATALOG.schema.json",
);
export const AJV_VERSION = require("ajv/package.json").version;
export const AJV_FORMATS_VERSION = require("ajv-formats/package.json").version;

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function assertOfflineSchema(schema) {
  const remoteReferences = [];
  const visit = (value, location) => {
    if (Array.isArray(value)) {
      value.forEach((entry, index) => visit(entry, `${location}/${index}`));
      return;
    }
    if (!value || typeof value !== "object") return;
    for (const [key, entry] of Object.entries(value)) {
      const nextLocation = `${location}/${key}`;
      if (key === "$ref" && typeof entry === "string" && !entry.startsWith("#")) {
        remoteReferences.push(`${nextLocation}: ${entry}`);
      }
      visit(entry, nextLocation);
    }
  };
  visit(schema, "#");
  if (remoteReferences.length > 0) {
    throw new Error(`remote schema references are prohibited:\n${remoteReferences.join("\n")}`);
  }
}

export function compileMethodologySchema(schema) {
  assertOfflineSchema(schema);
  const ajv = new Ajv2020({
    allErrors: true,
    coerceTypes: false,
    messages: true,
    removeAdditional: false,
    strict: true,
    useDefaults: false,
    validateFormats: true,
    verbose: true,
  });
  addFormats(ajv, { mode: "full" });
  if (!ajv.validateSchema(schema)) {
    throw new Error(`invalid methodology schema:\n${formatAjvErrors(ajv.errors)}`);
  }
  return ajv.compile(schema);
}

export function validateCatalogWithSchema(catalog, schema) {
  const validate = compileMethodologySchema(schema);
  const valid = validate(catalog);
  return {
    valid,
    errors: valid ? [] : normalizeAjvErrors(validate.errors),
  };
}

export function validateCanonicalCatalog() {
  const schema = readJson(SCHEMA_PATH);
  const catalog = readJson(CATALOG_PATH);
  if (catalog.schemaId !== schema.$id) {
    throw new Error(`catalog schemaId ${catalog.schemaId} does not equal schema $id ${schema.$id}`);
  }
  return validateCatalogWithSchema(catalog, schema);
}

export function normalizeAjvErrors(errors) {
  return [...(errors ?? [])]
    .map((error) => ({
      instancePath: error.instancePath,
      schemaPath: error.schemaPath,
      keyword: error.keyword,
      message: error.message,
      params: error.params,
    }))
    .sort((left, right) => {
      const leftKey = `${left.instancePath}|${left.schemaPath}|${left.keyword}|${left.message}`;
      const rightKey = `${right.instancePath}|${right.schemaPath}|${right.keyword}|${right.message}`;
      return leftKey.localeCompare(rightKey);
    });
}

export function formatAjvErrors(errors) {
  return normalizeAjvErrors(errors)
    .map((error) => `${error.instancePath || "/"} ${error.message} (${error.schemaPath})`)
    .join("\n");
}
