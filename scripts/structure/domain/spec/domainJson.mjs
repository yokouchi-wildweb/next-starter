// domain.json の語彙（キーと値の集合）。正は src/domains/README.md「API」と、項目の型
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
  RELATION_KEYS,
  RELATION_TYPES,
  TABLE_KEYS,
} from "../../../../src/lib/domain/node.mjs";

// 鍵と値の集合の正は src/lib/domain/definition/declaration.mjs(新しい形 domain.json + entities/<登録名>/entity.json と共通)。
// ここは今の 1 ファイルの形の組み合わせだけを持つ(この形は区切り domain-decl の中で退く)

/** 開発者のメモのキー（JSON Schema の注記と同じ名前）。どの階層にも書け、生成器も client の写しも読まない。値は文字列か文字列の配列 */
export const COMMENT_KEY = DECLARATION_COMMENT_KEY;

export { COLLECTION_KEYS, DB_ENGINES, FIELD_GROUP_KEYS, ID_TYPES, ON_DELETE_VALUES, RELATION_KEYS, RELATION_TYPES };

/** 今の 1 ファイルの形のトップレベルの鍵 = 表の鍵 + 版・生成の旗・複合ユニーク(新しい形では indexes の unique)・メモ */
export const TOP_LEVEL_KEYS = new Set([...TABLE_KEYS, "domainConfigVersion", "compositeUniques", "generate", COMMENT_KEY]);

/** 旧キー → 今のキー（移行の案内に使う） */
export const LEGACY_TOP_LEVEL_KEYS = { version: '"domainConfigVersion"' };

export const LEGACY_RELATION_KEYS = { onDeleteCascade: 'onDelete: "CASCADE" / "RESTRICT"' };
export const RELATION_FORM_INPUTS = {
  belongsTo: new Set(["select", "combobox", "asyncCombobox", "custom"]),
  belongsToMany: new Set(["checkbox", "multiSelect", "asyncMultiSelect", "custom"]),
};

/** Field のキー（lib/domain の DomainField のキーと同じ）。列の形 column は新しい形の entity.json だけ */
export const FIELD_KEYS = new Set([...ENTITY_FIELD_KEYS].filter((key) => key !== "column"));

/** フォーム入力種別（組み込みの名前の正は src/lib/domain/fields/formInputs.mjs） */
export const FORM_INPUT_VALUES = new Set(BUILTIN_FORM_INPUTS);

/** その DB で使える fieldType（src/lib/domain/fields/fieldFormInputs.mjs の表のキー） */
export function fieldTypesFor(dbEngine) {
  return new Set(Object.keys(FORM_INPUTS[dbEngine] ?? {}));
}

