// domain.json の語彙（キーと値の集合）。正は src/features/README.md「domain.json スキーマ定義」と
// src/components/Form/Field/types.ts の FieldConfig。checks/vocabulary.mjs がこれと照合して、綴り違い・古いキー・
// その DB に無い型を警告する（生成は止めない）。

import { GENERATE_CATEGORIES } from "./categories.mjs";
import { FORM_INPUTS } from "./formInputs.mjs";

export const DB_ENGINES = new Set(["Neon", "Firestore"]);
export const ID_TYPES = new Set(["uuid", "string", "number", "db"]);

export const TOP_LEVEL_KEYS = new Set([
  "domainConfigVersion", "singular", "plural", "label", "dbEngine", "idType", "relations", "useCreatedAt", "useUpdatedAt",
  "useSoftDelete", "sortOrderField", "fields", "fieldGroups", "searchFields", "searchRank", "defaultOrderBy", "tableFields",
  "useDetailModal", "addToAdminDataMenu", "useDuplicateButton", "useImportExport", "useAutoSave", "compositeUniques", "indexes",
  "systemColumns", "hiddenColumns", "apiAccess", "generateFiles",
]);

/** 旧キー → 今のキー（移行の案内に使う） */
export const LEGACY_TOP_LEVEL_KEYS = { version: '"domainConfigVersion"' };

export const RELATION_KEYS = new Set(["domain", "label", "fieldName", "fieldType", "relationType", "required", "onDelete", "includeRelationTable", "labelField", "formInput"]);
export const LEGACY_RELATION_KEYS = { onDeleteCascade: 'onDelete: "CASCADE" / "RESTRICT"' };
export const RELATION_TYPES = new Set(["belongsTo", "hasMany", "hasOne", "belongsToMany"]);
export const ON_DELETE_VALUES = new Set(["RESTRICT", "CASCADE", "SET_NULL"]);
export const RELATION_FORM_INPUTS = {
  belongsTo: new Set(["select", "combobox", "asyncCombobox", "custom"]),
  belongsToMany: new Set(["checkbox", "multiSelect", "asyncMultiSelect", "custom"]),
};

/** Field のキー（FieldConfig と、生成器だけが読む unique / storage / collection） */
export const FIELD_KEYS = new Set([
  "name", "label", "fieldType", "formInput", "required", "readonly", "disabled", "defaultValue", "options", "displayType", "placeholder",
  "slug", "mediaTypePreset", "accept", "validationRule", "helperText", "metadataBinding", "reorderable", "unique", "storage", "collection",
]);

/** 主の集まりの項目（fieldType mediaCollection）の collection のキー: 従属ドメインの singular・最大件数・複製で写すか */
export const COLLECTION_KEYS = new Set(["domain", "maxItems", "duplicate"]);

/** フォーム入力種別（README の FormInput 一覧 + 各 DB の表に出る種別の camelCase） */
export const FORM_INPUT_VALUES = new Set([
  "textInput", "numberInput", "textarea", "select", "multiSelect", "radio", "checkbox", "stepperInput", "switchInput", "dateInput",
  "timeInput", "datetimeInput", "emailInput", "passwordInput", "colorInput", "mediaUploader", "mediaUploaderMulti", "hidden", "none", "custom",
]);

/** その DB で使える fieldType（spec/formInputs.mjs の表のキー） */
export function fieldTypesFor(dbEngine) {
  return new Set(Object.keys(FORM_INPUTS[dbEngine] ?? {}));
}

export const GENERATE_FILE_KEYS = new Set(GENERATE_CATEGORIES);
