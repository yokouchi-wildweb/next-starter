// scripts/registry/alpha/domainDisplay.mjs
// domain.json から client に出す写し(<domain>/entities/display.ts)を作る(D21・L1.44)。
// 写すのは許可の一覧の項目だけ。domain.json に項目が増えても勝手に client へ出ない。hiddenColumns の列は写さない。
// Firestore の domain は名前を camelCase にする(createDomainConfigLookup の正規化と同じ)。

import { isAsyncRelationFormInput } from "../../../src/lib/domain/relations/relationOptions.mjs";
import { toCamelCase } from "../../../src/utils/stringCase.mjs";

const FIELD_KEYS = ["name", "label", "fieldType", "formInput", "options"];
const RELATION_KEYS = ["domain", "label", "fieldName", "fieldType", "relationType", "required", "formInput", "labelField", "includeRelationTable"];

const pick = (source, keys) => Object.fromEntries(keys.filter((key) => source[key] !== undefined).map((key) => [key, source[key]]));

const nameResolver = (config) => (config.dbEngine === "Firestore" ? (name) => toCamelCase(name) || name : (name) => name);

/** 非同期検索の関連にだけ、関連先の searchFields を付ける(他の関連には関連先の列名を出さない) */
function toDisplayRelation(relation, allConfigs) {
  const display = pick(relation, RELATION_KEYS);
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
  return {
    singular: config.singular,
    plural: config.plural,
    label: config.label,
    fields: (config.fields ?? []).filter((field) => isPublic(field.name)).map((field) => ({ ...pick(field, FIELD_KEYS), name: resolve(field.name) })),
    relations: (config.relations ?? []).map((relation) => toDisplayRelation(relation, allConfigs)),
    searchFields: (config.searchFields ?? []).filter(isPublic).map(resolve),
    useCreatedAt: Boolean(config.useCreatedAt),
    useUpdatedAt: Boolean(config.useUpdatedAt),
    useSoftDelete: Boolean(config.useSoftDelete),
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
    `export const domainDisplay = ${JSON.stringify(toDomainDisplay(config, allConfigs), null, 2)} as const satisfies DomainDisplay;`,
    "",
  ].join("\n");
}
