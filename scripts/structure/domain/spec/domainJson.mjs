// 登録の宣言 entities/<登録名>/entity.json の語彙（キーと値の集合）。正は src/domains/README.md「API」と、項目の型
// src/lib/domain/types/domainField.ts の DomainField（関連は types/domainConfig.ts の DomainConfigRelation）。checks/vocabulary.mjs がこれと照合して、綴り違い・古いキー・
// その DB に無い型を警告する（生成は止めない）。

import {
  BUILTIN_FORM_INPUTS,
  COLLECTION_KEYS,
  DB_ENGINES,
  DECLARATION_COMMENT_KEY,
  FIELD_GROUP_KEYS,
  FIELD_KEYS as ENTITY_FIELD_KEYS,
  FORM_INPUTS,
  ID_TYPES,
  ON_DELETE_VALUES,
  ENTITY_KEYS,
  RELATION_KEYS as ENTITY_RELATION_KEYS,
  RELATION_TYPES,
} from "../../../../src/lib/domain/node.mjs";

// 鍵と値の集合の正は src/lib/domain/definition/declaration.mjs。ここは生成器の検査(checks/vocabulary.mjs)が使う名前で並べ直すだけ

/** 開発者のメモのキー（JSON Schema の注記と同じ名前）。どの階層にも書け、生成器も client の写しも読まない。値は文字列か文字列の配列 */
export const COMMENT_KEY = DECLARATION_COMMENT_KEY;

export { COLLECTION_KEYS, DB_ENGINES, FIELD_GROUP_KEYS, ID_TYPES, ON_DELETE_VALUES, RELATION_TYPES };

/** 関連のキー */
export const RELATION_KEYS = ENTITY_RELATION_KEYS;

/** entity.json のトップレベルの鍵 = 表の鍵 + 表の形の鍵 + 登録の鍵(generate など)+ メモ */
export const TOP_LEVEL_KEYS = ENTITY_KEYS;

/** 旧キー → 今のキー（移行の案内に使う） */
export const LEGACY_TOP_LEVEL_KEYS = { version: '"domainConfigVersion"' };

export const LEGACY_RELATION_KEYS = { onDeleteCascade: 'onDelete: "CASCADE" / "RESTRICT"' };
export const RELATION_FORM_INPUTS = {
  belongsTo: new Set(["select", "combobox", "asyncCombobox", "custom"]),
  belongsToMany: new Set(["checkbox", "multiSelect", "asyncMultiSelect", "custom"]),
};

/** Field のキー（lib/domain の DomainField のキーと同じ + 列の形 column） */
export const FIELD_KEYS = ENTITY_FIELD_KEYS;

/** フォーム入力種別（組み込みの名前の正は src/lib/domain/fields/formInputs.mjs） */
export const FORM_INPUT_VALUES = new Set(BUILTIN_FORM_INPUTS);

/** その DB で使える fieldType（src/lib/domain/fields/fieldFormInputs.mjs の表のキー） */
export function fieldTypesFor(dbEngine) {
  return new Set(Object.keys(FORM_INPUTS[dbEngine] ?? {}));
}

