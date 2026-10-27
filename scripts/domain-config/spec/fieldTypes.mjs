// domain.json の項目（fields）の種別の述語。生成器・質問・検査がここだけを見る。
// 新しい項目の種類を足すときは、ここに述語を 1 つ足し、生成器はその述語で分岐する。

/** メディア列（ファイル台帳との連動 = createCrudService の storage binding を持つ列。binding は Drizzle 専用） */
export const MEDIA_FIELD_TYPES = new Set(["mediaUploader", "mediaUploaderMulti"]);

export function isMediaFieldType(fieldType) {
  return MEDIA_FIELD_TYPES.has(fieldType);
}

/**
 * メディア列を { name, multi } で返す
 * @param {{ fields?: Array<{ name: string, fieldType: string }> } | null | undefined} config
 */
export function collectMediaFields(config) {
  if (!Array.isArray(config?.fields)) return [];
  return config.fields
    .filter((f) => MEDIA_FIELD_TYPES.has(f.fieldType))
    .map((f) => ({ name: f.name, multi: f.fieldType === "mediaUploaderMulti" }));
}

/** 選択肢（options）を持つ項目。constants/field.ts と types/field.ts の生成対象 */
export function collectOptionFields(config) {
  return (config?.fields || []).filter((field) => Array.isArray(field.options) && field.options.length > 0);
}

export function hasOptionFields(config) {
  return collectOptionFields(config).length > 0;
}
