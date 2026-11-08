// src/lib/districtMap — 地区(district)の地図の読み手。中身: ./README.md
// 入口は 2 つ: この index.mjs(注入で読む。node:fs を使わない)と ./node.mjs(今の木を node:fs で読む)
export { readDistrictMap, toJsonl } from "./read.mjs";
export { readDomainEntry, readFrameName, readRuleFeatures, readTableNames } from "./fields.mjs";
export * from "./kinds.mjs";
