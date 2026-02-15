#!/usr/bin/env node
import fs from "fs";
import path from "path";
import {
  toPlural,
  toCamelCase,
  toPascalCase,
  toSnakeCase,
} from "../../../../src/utils/stringCase.mjs";

import generateGet from "./get.mjs";
import generateList from "./list.mjs";
import generateSearch from "./search.mjs";
import generateCreate from "./create.mjs";
import generateUpdate from "./update.mjs";
import generateUpsert from "./upsert.mjs";
import generateDelete from "./delete.mjs";
import generateBulkDeleteByIds from "./bulkDeleteByIds.mjs";
import generateBulkDeleteByQuery from "./bulkDeleteByQuery.mjs";
import generateBulkUpsert from "./bulkUpsert.mjs";
import generateBulkUpdate from "./bulkUpdate.mjs";
import generateViewModal from "./viewModal.mjs";
import generateDuplicate from "./duplicate.mjs";
import generateRestore from "./restore.mjs";
import generateHardDelete from "./hardDelete.mjs";
import generateReorder from "./reorder.mjs";
import generateSearchForSorting from "./searchForSorting.mjs";

// 各種フックをまとめて生成するエントリースクリプト
//
// 使い方:
//   node scripts/domain-config/generator/hooks/index.mjs <Domain>
//   node scripts/domain-config/generator/hooks/index.mjs <Domain> --plural <複数形>

const args = process.argv.slice(2);
const domain = args[0];

let pluralArg;
const pluralIndex = args.findIndex((a) => a === "--plural" || a === "-p");
if (pluralIndex !== -1) {
  pluralArg = args[pluralIndex + 1];
}

if (!domain) {
  console.error(
    "使い方: node scripts/domain-config/generator/hooks/index.mjs <Domain> [--plural <plural>]"
  );
  process.exit(1);
}

const normalized = toSnakeCase(domain) || domain;
const camel = toCamelCase(normalized) || normalized;
const pascal = toPascalCase(normalized) || normalized;

const camelPlural = pluralArg ? toCamelCase(pluralArg) : toPlural(camel);
const pascalPlural = pluralArg ? toPascalCase(pluralArg) : toPlural(pascal);

const configPath = path.join(process.cwd(), "src", "features", camel, "domain.json");
let domainConfig = null;
if (fs.existsSync(configPath)) {
  domainConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
}

const tokens = { camel, pascal, camelPlural, pascalPlural, config: domainConfig };

// 基本フック
const generators = [
  generateGet,
  generateList,
  generateSearch,
  generateCreate,
  generateUpdate,
  generateUpsert,
  generateDelete,
  generateBulkDeleteByIds,
  generateBulkDeleteByQuery,
  generateBulkUpsert,
  generateBulkUpdate,
];

// 条件付きフック
if (domainConfig?.useDetailModal) {
  generators.push(generateViewModal);
}

if (domainConfig?.useDuplicateButton) {
  generators.push(generateDuplicate);
}

if (domainConfig?.useSoftDelete) {
  generators.push(generateRestore);
  generators.push(generateHardDelete);
}

if (domainConfig?.sortOrderField) {
  generators.push(generateReorder);
  generators.push(generateSearchForSorting);
}

generators.forEach((g) => g(tokens));
