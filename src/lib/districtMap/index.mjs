// src/lib/districtMap — 地区(district)の地図の読み手。中身: ./README.md
// 入口は 2 つ: この index.mjs(読み方を注入する。この lib 自身は node:fs で読まない)と ./node.mjs(今の木を node:fs で読む)
export { configSlotsOf, discoverDistricts, readDistrictMap, toJsonl } from "./read.mjs";
export { OVERRIDE_IMPORTS_EXPORT, readDomainEntry, readFrameName, readOverrideImports, readRuleDomains, readTableNames } from "./fields.mjs";
export * from "./kinds.mjs";
