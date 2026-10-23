// メディア列（mediaUploader / mediaUploaderMulti）の判定。
// メディア列はファイル台帳との連動（createCrudService の storage binding）を前提とし、binding は Drizzle 専用。

const MEDIA_FIELD_TYPES = new Set(["mediaUploader", "mediaUploaderMulti"]);

/**
 * メディア列を { name, multi } で返す
 */
export function collectMediaFields(config) {
  if (!Array.isArray(config?.fields)) return [];
  return config.fields
    .filter((f) => MEDIA_FIELD_TYPES.has(f.fieldType))
    .map((f) => ({ name: f.name, multi: f.fieldType === "mediaUploaderMulti" }));
}

/**
 * Firestore ドメインのメディア列はエラー文を返す（Firestore adapter は凍結で binding を持たない）。問題なければ null
 */
export function checkMediaFieldsEngine(camel, config, dbEngine = config?.dbEngine) {
  const mediaFields = collectMediaFields(config);
  if (dbEngine !== "Firestore" || mediaFields.length === 0) return null;
  return (
    `[${camel}] Firestore ドメインにはメディア列（mediaUploader / mediaUploaderMulti）を置けません: ` +
    `${mediaFields.map((f) => f.name).join(", ")}。ファイルを持つドメインは dbEngine "Neon" にしてください。`
  );
}
