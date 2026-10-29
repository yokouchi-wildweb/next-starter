// src/lib/domain/fields/fieldTypes.mjs
// domain.json の項目の型（fieldType）の意味を決める表。型の意味の持ち主はここ 1 か所で、
// 生成器（scripts/domain-config。spec/fieldTypes.mjs は再 export）も実行時（フォームの初期値・checkbox の単複・編集時の日時変換）も
// fieldTypeSpec(type) とここの導出関数でこの表を引く。ここ以外に型名の集合や型名の比較を書かない。
// .mjs なのは、tsx を通さない生成器（node）からも TypeScript からも import できるようにするため（relationOptions.mjs と同じ）。
//
// 新しい型を足すときは FIELD_TYPES に 1 行足し（formDefault は必ず書く）、scripts/domain-config/spec/formInputs.mjs に入力種別を、
// src/components/Form/Field/types.ts の union に型名を足す（ずれは pnpm test:form-defaults と typecheck が検知する）。
// 表に無い型は「未知型」: 生成器は型名をそのまま列関数に出して警告、フォームの初期値は ""、日時変換も複数選択もしない。
// 型名は小文字化せずにそのまま引く（"timestamp with time zone" は未知型）。
//
// 生成器が読む属性:
//   column    drizzle-orm/pg-core の列関数（無ければ型名そのまま。配列・enum・タイムゾーン付きは生成器が別扱い）
//   columnMode 列関数の mode（"number" = 読み出しを number にする。DB の列型は変わらない）
//   zod       Zod の式（無ければ z.any()。datetime の型は datetime 属性で決まる）
//   ts        TS の型（無ければ any）
//   text      文字列系: Zod で .trim()、必須なら .min(1)、任意なら emptyToNull を通す
//   emailFormat メールアドレスの形: Zod で .email()、任意なら "" も通す
//   enumValues 値は項目の options のどれか（Zod は z.enum、TS は値の union、列は生成器が別扱い）
//   numeric   数値系: 選択肢の値を数値で読む、デフォルト値を数値で読む
//   media     メディア列（storage binding の対象。1 列 = 1 ファイル。複数は mediaCollection）
//   array     配列列（text[]、必須は空配列既定）。フォームの checkbox はこの型だけ複数選択にする
//   presenter 表示フォーマッタの種類（無ければ formInput で決める）
//   noDefault domain.json の defaultValue を持てない（生成前の検査 checks/fields.mjs が止める）
//   collection 主の集まり（列を持たない。従属ドメインの行の並びを lib の collections で読み書きする。項目の collection キーで宣言）
//   retired   廃止した型: 生成前の検査（checks/retiredFieldTypes.mjs）が移り先の案内文で止める。実行時は見ない
// 意味の属性（生成器と実行時の両方が読む）:
//   datetime  日時の型: Zod は required で requiredDatetime / nullableDatetime、編集フォームでは値を Date にする
//   formDefault  フォームの初期値（domain.json の defaultValue が無いとき）。全行に書く（undefined も値）。配列は呼ぶたびに複製して返す
//   formDefaultWithChoices  選択肢のある項目（formInput "radio" か options あり）での初期値。無ければ formDefault

export const FIELD_TYPES = {
  string: { column: "text", zod: "z.string()", ts: "string", text: true, formDefault: "" },
  email: { column: "text", zod: "z.string()", ts: "string", text: true, emailFormat: true, formDefault: "" },
  password: { column: "text", zod: "z.string()", ts: "string", text: true, formDefault: "" },
  uuid: { column: "uuid", zod: "z.string()", ts: "string", text: true, formDefault: "" },
  mediaUploader: { column: "text", zod: "z.string()", ts: "string", text: true, media: true, noDefault: true, formDefault: "" },
  integer: { column: "integer", zod: "z.coerce.number().int()", ts: "number", numeric: true, presenter: "number", formDefault: undefined },
  number: { zod: "z.coerce.number().int()", ts: "number", numeric: true, presenter: "number", formDefault: undefined },
  float: { column: "doublePrecision", zod: "z.coerce.number()", ts: "number", numeric: true, presenter: "number", formDefault: undefined },
  bigint: { column: "bigint", columnMode: "number", zod: "z.coerce.number().int()", ts: "number", numeric: true, formDefault: undefined },
  "numeric(10,2)": { column: "numeric", columnMode: "number", zod: "z.coerce.number()", ts: "number", numeric: true, formDefault: undefined },
  boolean: { column: "boolean", zod: "z.coerce.boolean()", ts: "boolean", presenter: "boolean", formDefault: false, formDefaultWithChoices: undefined },
  date: { column: "date", zod: "z.string()", ts: "string", text: true, formDefault: "" },
  time: { column: "time", zod: "z.string()", ts: "string", text: true, formDefault: "" },
  timestamp: { datetime: true, ts: "Date", noDefault: true, formDefault: undefined },
  "timestamp With Time Zone": { column: "timestamp", datetime: true, ts: "Date", noDefault: true, formDefault: undefined },
  // jsonb / map は値なし。schema の .default() や DB の既定値に任せる（"" だと record / object の schema で落ちる）
  jsonb: { column: "jsonb", zod: "z.unknown()", ts: "any", noDefault: true, formDefault: undefined },
  array: { zod: "z.array(z.string())", ts: "string[]", array: true, presenter: "stringArray", noDefault: true, formDefault: [] },
  stringArray: { zod: "z.array(z.string())", ts: "string[]", array: true, presenter: "stringArray", noDefault: true, formDefault: [] },
  enum: { presenter: "enum", enumValues: true, formDefault: undefined },
  mediaCollection: { ts: "string[]", collection: true, noDefault: true, formDefault: [] },
  // 入力欄の候補（formInputs.mjs）にあり、生成器の属性を持たない型。生成器の答えは未知型と同じ（型名そのままの列関数・z.any()・any）
  Point: { formDefault: "" },
  map: { formDefault: undefined },
  geopoint: { formDefault: "" },
  reference: { formDefault: "" },
  null: { formDefault: "" },
  // 廃止。生成器は止める。まだ列を持つ fork のために実行時の初期値は残す
  mediaUploaderMulti: {
    formDefault: [],
    retired:
      '複数のメディアは mediaCollection（集まり）に移してください。手順: src/lib/crud/README.md「既存の mediaUploaderMulti 列からの移行」',
  },
};

const UNKNOWN_SPEC = Object.freeze({});
const UNKNOWN_FORM_DEFAULT = "";

/**
 * 型の行（表に無い型・undefined は空の行）
 * @param {string | undefined} fieldType
 */
export function fieldTypeSpec(fieldType) {
  if (fieldType === undefined || !Object.hasOwn(FIELD_TYPES, fieldType)) return UNKNOWN_SPEC;
  return /** @type {Record<string, unknown>} */ (FIELD_TYPES[/** @type {keyof typeof FIELD_TYPES} */ (fieldType)]);
}

const spec = fieldTypeSpec;

/** drizzle-orm/pg-core の列関数名（未知の型は型名そのまま） */
export function columnFunction(fieldType) {
  return spec(fieldType).column ?? fieldType;
}

/** 列関数の mode（無ければ undefined） */
export function columnMode(fieldType) {
  return spec(fieldType).columnMode;
}

/** Zod の式。datetime は required で分ける（未知の型は z.any()） */
export function zodType(fieldType, required = false) {
  if (spec(fieldType).datetime) return required ? "requiredDatetime" : "nullableDatetime";
  return spec(fieldType).zod ?? "z.any()";
}

/** TS の型（未知の型は any） */
export function tsType(fieldType) {
  return spec(fieldType).ts ?? "any";
}

/** @param {string | undefined} fieldType */
export const isTextFieldType = (fieldType) => Boolean(spec(fieldType).text);
/** @param {string | undefined} fieldType */
export const isEnumFieldType = (fieldType) => Boolean(spec(fieldType).enumValues);
/** @param {string | undefined} fieldType */
export const isEmailFieldType = (fieldType) => Boolean(spec(fieldType).emailFormat);
/** @param {string | undefined} fieldType */
export const isNumericFieldType = (fieldType) => Boolean(spec(fieldType).numeric);
/** @param {string | undefined} fieldType */
export const isArrayFieldType = (fieldType) => Boolean(spec(fieldType).array);
/** 日時の型（編集フォームで値を Date にする） @param {string | undefined} fieldType */
export const isTimestampFieldType = (fieldType) => Boolean(spec(fieldType).datetime);
/** @param {string | undefined} fieldType */
export const isMediaFieldType = (fieldType) => Boolean(spec(fieldType).media);
/** @param {string | undefined} fieldType */
export const isCollectionFieldType = (fieldType) => Boolean(spec(fieldType).collection);
/** @param {string | undefined} fieldType */
export const allowsDefaultValue = (fieldType) => !spec(fieldType).noDefault;
/** @param {string | undefined} fieldType */
export const presenterKind = (fieldType) => spec(fieldType).presenter;

/** formInput "checkbox" を複数選択（CheckGroupInput）にする型 = 値が文字列の配列の型（array 属性） @param {string | undefined} fieldType */
export const isCheckGroupFieldType = (fieldType) => isArrayFieldType(fieldType);

/**
 * 廃止した型なら移り先の案内文
 * @param {string | undefined} fieldType
 * @returns {string | undefined}
 */
export function retiredFieldTypeMessage(fieldType) {
  const retired = spec(fieldType).retired;
  return typeof retired === "string" ? retired : undefined;
}

/**
 * フォームの初期値（domain.json の defaultValue が無いときの値）。未知の型は ""
 * @param {{ fieldType?: string, formInput?: string, options?: unknown }} field
 * @returns {unknown}
 */
export function formDefaultFor(field) {
  const row = spec(field.fieldType);
  const hasChoices = field.formInput === "radio" || (Array.isArray(field.options) && field.options.length > 0);
  let value = UNKNOWN_FORM_DEFAULT;
  if (hasChoices && Object.hasOwn(row, "formDefaultWithChoices")) value = row.formDefaultWithChoices;
  else if (Object.hasOwn(row, "formDefault")) value = row.formDefault;
  // 表の配列を共有すると別のフォーム同士で値が混ざるので、呼ぶたびに新しい配列にする
  return Array.isArray(value) ? [...value] : value;
}

/** メディア列（ファイル台帳との連動 = createCrudService の storage binding を持つ列。binding は Drizzle 専用） */
export const MEDIA_FIELD_TYPES = new Set(Object.keys(FIELD_TYPES).filter((t) => fieldTypeSpec(t).media));

/**
 * メディア列を { name } で返す
 * @param {{ fields?: Array<{ name: string, fieldType: string }> } | null | undefined} config
 */
export function collectMediaFields(config) {
  if (!Array.isArray(config?.fields)) return [];
  return config.fields.filter((f) => MEDIA_FIELD_TYPES.has(f.fieldType)).map((f) => ({ name: f.name }));
}

/** 選択肢（options）を持つ項目。constants/field.ts と types/field.ts の生成対象 */
export function collectOptionFields(config) {
  return (config?.fields || []).filter((field) => Array.isArray(field.options) && field.options.length > 0);
}

export function hasOptionFields(config) {
  return collectOptionFields(config).length > 0;
}
