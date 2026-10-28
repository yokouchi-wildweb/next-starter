// domain.json の項目の型（fieldType）の語彙と、型ごとの出力の対応表。生成器・質問・検査はここだけを見る。
// 新しい型を足すときは FIELD_TYPES に 1 行足し、spec/formInputs.mjs に入力種別を足す。生成器側の switch は無い。
// フォーム側（src/components/Form）の既定値・checkbox・型の名前は手書きなので、そちらも足す（ずれは pnpm test:form-defaults と typecheck が検知する）。
//
//   column    drizzle-orm/pg-core の列関数（無ければ型名そのまま。配列・enum・タイムゾーン付きは生成器が別扱い）
//   zod       Zod の式（無ければ z.any()）。datetime は required で nullableDatetime / requiredDatetime に分かれる
//   ts        TS の型（無ければ any）
//   text      文字列系: Zod で .trim()、必須なら .min(1)、任意なら emptyToNull を通す
//   numeric   数値系: 選択肢の値を数値で読む、デフォルト値を数値で読む
//   media     メディア列（storage binding の対象。multi = 複数）
//   array     配列列（text[]、必須は空配列既定）
//   presenter 表示フォーマッタの種類（無ければ formInput で決める）
//   noDefault dc:init でデフォルト値を聞かない
//   collection 主の集まり（列を持たない。従属ドメインの行の並びを lib の collections で読み書きする。項目の collection キーで宣言）

export const FIELD_TYPES = {
  string: { column: "text", zod: "z.string()", ts: "string", text: true },
  email: { column: "text", zod: "z.string()", ts: "string", text: true },
  password: { column: "text", zod: "z.string()", ts: "string", text: true },
  uuid: { column: "uuid", zod: "z.string()", ts: "string", text: true },
  mediaUploader: { column: "text", zod: "z.string()", ts: "string", text: true, media: true },
  mediaUploaderMulti: { column: "text", ts: "string[]", media: true, multi: true },
  integer: { column: "integer", zod: "z.coerce.number().int()", ts: "number", numeric: true, presenter: "number" },
  number: { zod: "z.coerce.number().int()", ts: "number", numeric: true, presenter: "number" },
  float: { column: "doublePrecision", zod: "z.coerce.number()", ts: "number", numeric: true, presenter: "number" },
  bigint: { column: "bigint", ts: "number", numeric: true },
  "numeric(10,2)": { column: "numeric", ts: "number", numeric: true },
  boolean: { column: "boolean", zod: "z.coerce.boolean()", ts: "boolean", presenter: "boolean" },
  date: { column: "date", zod: "z.string()", ts: "string", text: true },
  time: { column: "time", zod: "z.string()", ts: "string", text: true },
  timestamp: { zod: "datetime", ts: "Date", noDefault: true },
  "timestamp With Time Zone": { column: "timestamp", zod: "datetime", ts: "Date", noDefault: true },
  jsonb: { column: "jsonb", zod: "z.unknown()", ts: "any", noDefault: true },
  array: { zod: "z.array(z.string())", ts: "string[]", array: true, presenter: "stringArray", noDefault: true },
  stringArray: { zod: "z.array(z.string())", ts: "string[]", array: true, presenter: "stringArray", noDefault: true },
  enum: { presenter: "enum" },
  mediaCollection: { ts: "string[]", collection: true },
};

const spec = (fieldType) => FIELD_TYPES[fieldType] ?? {};

/** drizzle-orm/pg-core の列関数名（未知の型は型名そのまま） */
export function columnFunction(fieldType) {
  return spec(fieldType).column ?? fieldType;
}

/** Zod の式。datetime は required で分ける（未知の型は z.any()） */
export function zodType(fieldType, required = false) {
  const zod = spec(fieldType).zod;
  if (zod === "datetime") return required ? "requiredDatetime" : "nullableDatetime";
  return zod ?? "z.any()";
}

/** TS の型（未知の型は any） */
export function tsType(fieldType) {
  return spec(fieldType).ts ?? "any";
}

export const isTextFieldType = (fieldType) => Boolean(spec(fieldType).text);
export const isNumericFieldType = (fieldType) => Boolean(spec(fieldType).numeric);
export const isArrayFieldType = (fieldType) => Boolean(spec(fieldType).array);
export const isTimestampFieldType = (fieldType) => spec(fieldType).zod === "datetime";
export const isMediaFieldType = (fieldType) => Boolean(spec(fieldType).media);
export const isCollectionFieldType = (fieldType) => Boolean(spec(fieldType).collection);
export const allowsDefaultValue = (fieldType) => !spec(fieldType).noDefault;
export const presenterKind = (fieldType) => spec(fieldType).presenter;

/** メディア列（ファイル台帳との連動 = createCrudService の storage binding を持つ列。binding は Drizzle 専用） */
export const MEDIA_FIELD_TYPES = new Set(Object.keys(FIELD_TYPES).filter((t) => FIELD_TYPES[t].media));

/**
 * メディア列を { name, multi } で返す
 * @param {{ fields?: Array<{ name: string, fieldType: string }> } | null | undefined} config
 */
export function collectMediaFields(config) {
  if (!Array.isArray(config?.fields)) return [];
  return config.fields.filter((f) => MEDIA_FIELD_TYPES.has(f.fieldType)).map((f) => ({ name: f.name, multi: Boolean(spec(f.fieldType).multi) }));
}

/** 選択肢（options）を持つ項目。constants/field.ts と types/field.ts の生成対象 */
export function collectOptionFields(config) {
  return (config?.fields || []).filter((field) => Array.isArray(field.options) && field.options.length > 0);
}

export function hasOptionFields(config) {
  return collectOptionFields(config).length > 0;
}
