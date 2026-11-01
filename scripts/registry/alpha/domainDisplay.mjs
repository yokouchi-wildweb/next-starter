// scripts/registry/alpha/domainDisplay.mjs
// domain.json から client に出す写し(<domain>/entities/display.ts)を作る(D21・L1.44)。
// 写すのは許可の一覧の項目だけ。domain.json に項目が増えても勝手に client へ出ない。hiddenColumns の列は写さない。
// Firestore の domain は名前を camelCase にする(normalizeDomainJsonConfig の正規化と同じ)。
// 列名を持つ項目(fields・searchFields・tableFields・sortOrderField・fieldGroups[].fields・relations.fieldName)は
// どれも同じ名前の変換と hiddenColumns の除外を通す。列名の項目を足すときはここに並べる。

import { isAsyncRelationFormInput } from "../../../src/lib/domain/relations/relationOptions.mjs";
import { toCamelCase } from "../../../src/utils/stringCase.mjs";

const FIELD_KEYS = ["name", "label", "fieldType", "formInput", "options", "required", "readonly", "defaultValue", "displayType", "placeholder", "accept", "validationRule", "reorderable", "helperText"];
const RELATION_KEYS = ["domain", "label", "fieldName", "fieldType", "relationType", "required", "formInput", "labelField", "includeRelationTable"];
const FIELD_GROUP_KEYS = ["key", "label", "fields", "collapsible", "defaultCollapsed", "bgColor"];

const pick = (source, keys) => Object.fromEntries(keys.filter((key) => source[key] !== undefined).map((key) => [key, source[key]]));

const nameResolver = (config) => (config.dbEngine === "Firestore" ? (name) => toCamelCase(name) || name : (name) => name);

/** 非同期検索の関連にだけ、関連先の searchFields を付ける(他の関連には関連先の列名を出さない) */
function toDisplayRelation(relation, allConfigs, resolve) {
  const display = { ...pick(relation, RELATION_KEYS), fieldName: resolve(relation.fieldName) };
  if (!isAsyncRelationFormInput(relation.formInput)) return display;
  const target = allConfigs.find((config) => toCamelCase(config.singular) === toCamelCase(relation.domain));
  if (!target?.searchFields) return display;
  return { ...display, searchFields: target.searchFields.map(nameResolver(target)) };
}

/**
 * domain.json → 写しの値
 * @param {object} config
 * @param {object[]} allConfigs 全ドメインの domain.json(関連先の引き当て)
 */
export function toDomainDisplay(config, allConfigs = []) {
  const resolve = nameResolver(config);
  const hidden = new Set(config.hiddenColumns ?? []);
  const isPublic = (name) => !hidden.has(toCamelCase(name) || name);
  const publicNames = (names) => names.filter(isPublic).map(resolve);
  // 無いキーは写しにも出さない(手書きの写しと同じく optional)
  const optional = {
    ...pick(config, ["useImportExport"]),
    ...(config.sortOrderField !== undefined && isPublic(config.sortOrderField) ? { sortOrderField: resolve(config.sortOrderField) } : {}),
    ...(config.fieldGroups ? { fieldGroups: config.fieldGroups.map((group) => ({ ...pick(group, FIELD_GROUP_KEYS), fields: publicNames(group.fields ?? []) })) } : {}),
    ...(config.tableFields ? { tableFields: publicNames(config.tableFields) } : {}),
  };
  return {
    singular: config.singular,
    plural: config.plural,
    label: config.label,
    fields: (config.fields ?? []).filter((field) => isPublic(field.name)).map((field) => ({ ...pick(field, FIELD_KEYS), name: resolve(field.name) })),
    relations: (config.relations ?? []).filter((relation) => isPublic(relation.fieldName)).map((relation) => toDisplayRelation(relation, allConfigs, resolve)),
    searchFields: publicNames(config.searchFields ?? []),
    useCreatedAt: Boolean(config.useCreatedAt),
    useUpdatedAt: Boolean(config.useUpdatedAt),
    useSoftDelete: Boolean(config.useSoftDelete),
    ...optional,
  };
}

/** 写しのファイルの置き場(domain.json の隣の entities/) */
export const domainDisplayPath = (domainJsonFile) => domainJsonFile.replace(/domain\.json$/, "entities/display.ts");

/** 写しのファイルの中身 */
export function renderDomainDisplay(domainJsonFile, config, allConfigs = []) {
  return [
    `// 生成物・編集不可: pnpm registry:generate が ${domainJsonFile} から生成する`,
    `// client に出す表示用の写し(秘密・内部の項目は持たない)。詳細: src/lib/domain/README.md`,
    "",
    `import type { DomainDisplay } from "@/lib/domain/types/display";`,
    "",
    `export const domainDisplay: DomainDisplay = ${JSON.stringify(toDomainDisplay(config, allConfigs), null, 2)};`,
    "",
  ].join("\n");
}
