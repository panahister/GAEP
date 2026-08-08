#!/usr/bin/env node

import fs from "node:fs";

import { canonicalJson, readJson, REGISTRY_PATH } from "./lib/market_benchmark_registry.mjs";

fs.writeFileSync(REGISTRY_PATH, canonicalJson(readJson(REGISTRY_PATH)));
console.log("Canonicalized GAEP-REG-013 string-set ordering and JSON serialization.");
