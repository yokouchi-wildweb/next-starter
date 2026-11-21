// src/lib/districtMap — 地区(district)の地図の読み手。中身: ./README.md
// 入口は 2 つ: "." = この index.mjs(読み方を注入する。ファイルを読まず node の API を引かない)、
// "./node" = ./node.mjs(今の木を node:fs で読む物と node:path を使う物。Next の外のプログラム = scripts・lint・テストが読む)
export { configSlotsOf, discoverDistricts, readDistrictMap, toJsonl } from "./read.mjs";
export { FEATURE_REQUIREMENTS_EXPORT, OVERRIDE_IMPORTS_EXPORT, OVERRIDE_LOADERS_EXPORT, readDomainEntry, readFeatureRequirements, readFrameName, readOverrideImports, readOverrideLoaders, readRuleDomains, readTableNames } from "./fields.mjs";
export * from "./kinds.mjs";
export { DECLARATION_NAME, DERIVES, EXTENSIONS_DIR_NAME, PLACEMENT_KINDS, SEARCH_ROOT, isDeclarationPath, isListPoint, literalOf, pointsFromFiles, readDeclaration } from "./declarations.mjs";
export { MARKER_MIGRATION_NOTICE, classifyDottedName, oldMarkerProblem } from "./dottedNames.mjs";
export { CLAIMED_DEFAULTS, DEFAULT_FILE, FRAME_DEFAULT_FILE, FRAME_FILE, FRAME_OVERRIDE_FILE, FRAME_SEARCH_ROOT, OVERRIDE_FILE, REPLACE_FILE, isClaimedDefault, isOverridePath, overrideGlobOf, overridePathOfTarget, switchSetOf, targetOfOverride } from "./extensionNames.mjs";
export { adminRouteFolderOf, camelPluralOf, toPlural } from "./domainNames.mjs";
