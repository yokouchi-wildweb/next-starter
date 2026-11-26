// src/lib/districtMap — 地区(district)の地図の読み手。中身: ./README.md
// 入口は 2 つ: "." = この index.mjs(読み方を注入する。ファイルを読まず node の API を引かない)、
// "./node" = ./node.mjs(今の木を node:fs で読む物と node:path を使う物。Next の外のプログラム = scripts・lint・テストが読む)
export { configSlotsOf, discoverDistricts, readDistrictMap, toJsonl } from "./read.mjs";
export { FEATURE_REQUIREMENTS_EXPORT, OVERRIDE_IMPORTS_EXPORT, OVERRIDE_LOADERS_EXPORT, readFeatureRequirements, readFrameName, readOverrideImports, readOverrideLoaders, readRuleDomains, readTableNames } from "./fields.mjs";
export * from "./kinds.mjs";
export { CHANGES, DECLARATION_NAME, DERIVES, changeOfFields, EXTENSIONS_DIR_NAME, PLACEMENT_KINDS, PLUGS_DIR_NAME, PLUGS_REGISTRY_FOLDERS, SEARCH_ROOT, isDeclarationPath, isListPoint, isPlugsPoint, isSelectPoint, literalOf, pointsFromFiles, readBackendDeclaration, readDeclaration, replacePointsOf, WIRE_NAME, ALWAYS_OPEN_NAME, BACKEND_ADAPTER_NAME, BACKEND_DECLARATION_NAME, BACKEND_REQUIREMENTS_NAME, BILLING_KINDS, CAPABILITY_NAME, exportedInitializer } from "./declarations.mjs";
export { MARKER_MIGRATION_NOTICE, classifyDottedName, oldMarkerProblem } from "./dottedNames.mjs";
export { CLAIMED_DEFAULTS, DEFAULT_FILE, FRAME_DEFAULT_FILE, FRAME_FILE, FRAME_OVERRIDE_FILE, FRAME_SEARCH_ROOT, OVERRIDE_FILE, REPLACE_FILE, isClaimedDefault, isOverridePath, overrideGlobOf, overridePathOfTarget, switchSetOf, targetOfOverride } from "./extensionNames.mjs";
export { adminRouteFolderOf, camelPluralOf, toPlural } from "./domainNames.mjs";
export { intakeRowsOf, literalGlob } from "./intakeRows.mjs";
